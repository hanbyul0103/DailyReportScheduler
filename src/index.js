const { Client, GatewayIntentBits, IntentsBitField, REST, Routes, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { CronJob } = require('cron');
const config = require('../config.json');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.GuildMessageReactions,
        IntentsBitField.Flags.GuildMembers,
    ],
});

const DATA_FILE = path.join(__dirname, 'data.json');

let dailyReportJobs = {};
let weeklyReportJobs = {};

function readData() {
    if (!fs.existsSync(DATA_FILE)) return {};
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function saveData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

const sharedCommands = [
    {
        name: 'setup',
        description: '팀, 공지할 시간, 채널, 역할을 설정합니다.',
        options: [
            {
                name: '팀',
                type: 3,
                description: '팀을 선택하세요',
                required: true,
                choices: [
                    { name: '기마부대', value: 'https://ggm.gondr.net/project/team/34' },
                    { name: '규민교', value: 'https://ggm.gondr.net/project/team/39' },
                    { name: 'HASHIRA', value: 'https://ggm.gondr.net/project/team/32' },
                    { name: '딥슬립', value: 'https://ggm.gondr.net/project/team/44' },
                    { name: '좋은쉼터', value: 'https://ggm.gondr.net/project/team/35' },
                    { name: '덕킹', value: 'https://ggm.gondr.net/project/team/37' },
                    { name: 'WINNER', value: 'https://ggm.gondr.net/project/team/33' },
                    { name: 'JMT', value: 'https://ggm.gondr.net/project/team/36' },
                    { name: '선한아이들', value: 'https://ggm.gondr.net/project/team/38' },
                    { name: '망망대해', value: 'https://ggm.gondr.net/project/team/41' },
                    { name: '필립강따시언', value: 'https://ggm.gondr.net/project/team/42' },
                    { name: '유성매직', value: 'https://ggm.gondr.net/project/team/40' },
                    { name: '시호', value: 'https://ggm.gondr.net/project/team/45' },
                    { name: '솔플', value: 'https://ggm.gondr.net/project/team/46' },
                    { name: '솔플 아트', value: 'https://ggm.gondr.net/project/team/47' },
                ],
            },
            {
                name: '시간',
                type: 4,
                description: '공지할 시간을 선택하세요 (0~23시)',
                required: true,
                choices: [...Array(24).keys()].map(i => ({
                    name: `오${i < 12 ? '전' : '후'} ${i % 12 === 0 ? 12 : i % 12}시`,
                    value: i,
                })),
            },
            {
                name: '채널',
                type: 7,
                description: '공지할 채널을 선택하세요',
                required: true,
                channel_types: [0],
            },
            {
                name: '역할',
                type: 8,
                description: '알림을 받을 역할을 선택하세요',
                required: true,
            },
        ],
    },
    {
        name: 'clear',
        description: '설정된 공지를 삭제합니다.',
    },
    {
        name: 'suggestion',
        description: '관리자에게 의견을 보내보세요!',
        options: [
            {
                name: '메시지',
                type: 3,
                description: '내용을 입력하세요',
                required: true,
            }
        ]
    }
];

const developmentCommands = [
    {
        name: 'notification',
        description: '업데이트 공지용 명령어',
        options: [
            {
                name: '메시지',
                type: 3,
                description: '공지할 내용을 입력하세요',
                required: true,
            }
        ],
    }
];

const rest = new REST({ version: '10' }).setToken(config.token);

(async () => {
    try {
        console.log('애플리케이션 (/) 명령어를 새로고침합니다.');
        await rest.put(
            Routes.applicationCommands(config.clientId),
            {
                body: sharedCommands
            }
        );
        console.log('성공적으로 (/) 명령어를 새로고침했습니다.');
    } catch (error) {
        console.error(error);
    }
})();

(async () => {
    try {
        console.log('애플리케이션 (/) 명령어를 새로고침합니다.');
        await rest.put(
            Routes.applicationGuildCommands(config.clientId, config.guildId),
            {
                body: developmentCommands
            }
        );
        console.log(`성공적으로 ${config.guildId} 서버에 특정 명령어를 등록했습니다.`);
    } catch (error) {
        console.error(error);
    }
})();

function clearScheduledJobs() {
    for (const serverId in dailyReportJobs) {
        dailyReportJobs[serverId].stop();
        delete dailyReportJobs[serverId];
    }

    for (const serverId in weeklyReportJobs) {
        weeklyReportJobs[serverId].stop();
    }
}

function scheduleMessages() {
    clearScheduledJobs();
    const data = readData();

    for (const serverId in data) {
        const { channelId, Link, time, members } = data[serverId];

        if (channelId && Link && time) {
            const dailyReport = registerDaily(channelId, Link, time, data, members, serverId);
            const weeklyReport = registerWeekly(channelId, Link, time, data, members, serverId);

            // 일간 보고서 알람
            dailyReport.start();
            dailyReportJobs[serverId] = dailyReport;

            // 주간 보고서 알람
            weeklyReport.start();
            weeklyReportJobs[serverId] = dailyReport;

            console.log(`[✅] ${serverId} 서버의 공지 예약 완료: ${time}시`);
        }
    }
}

function registerDaily(channelId, Link, time, data, members, serverId) {
    const dailyReport = new CronJob(`0 0 ${time} * * 1-5`, async () => {
        try {
            const channel = await client.channels.fetch(channelId);
            if (channel) {
                const embed = new EmbedBuilder()
                    .setColor(0x0099ff)
                    .setTitle('🚨 일간 보고서 쓰러가기')
                    .setURL(Link)
                    .setTimestamp(new Date());

                let message = await channel.send({
                    content: `<@&${data[serverId].roleId}>`,
                    embeds: [embed],
                });

                await message.react('✅');

                const filter = (reaction, user) => reaction.emoji.name === '✅' && members.includes(user.id);
                const now = new Date();
                const midnight = new Date(now);
                midnight.setHours(24, 0, 0, 0);
                const timeUntilMidnight = midnight - now;

                const collector = message.createReactionCollector({ filter, time: timeUntilMidnight });

                const interval = setInterval(async () => {
                    const now = new Date();
                    if (now >= midnight) {
                        clearInterval(interval);
                        return;
                    }

                    const reactedUsers = [...collector.collected.values()].flatMap(r => r.users.cache.map(u => u.id));
                    const notReacted = members.filter(id => !reactedUsers.includes(id));

                    if (notReacted.length > 0) {
                        await channel.send(`${notReacted.map(id => `<@${id}>`).join(', ')}\n🚨 일간 보고서를 아직 작성하지 않았어요!`);
                    }
                    else {
                        await channel.send(`🎉 모든 사람이 보고서를 작성했습니다.`);
                        clearInterval(interval);
                        collector.stop();
                    }
                }, 30 * 60 * 1000);
            }
        } catch (error) {
            console.error(`[!] 메시지 전송 오류:`, error);
        }
    });

    return dailyReport;
}

function registerWeekly(channelId, Link, time, data, members, serverId) {
    const weeklyReport = new CronJob(`0 0 ${time} * * 6`, async () => {
        try {
            const channel = await client.channels.fetch(channelId);
            if (channel) {
                const embed = new EmbedBuilder()
                    .setColor(0xff9900)
                    .setTitle('📅 주간 보고서 쓰러가기')
                    .setURL(Link)
                    .setTimestamp(new Date());

                const message = await channel.send({
                    content: `<@&${data[serverId].roleId}>`,
                    embeds: [embed],
                });

                await message.react('✅');

                const filter = (reaction, user) =>
                    reaction.emoji.name === '✅' && members.includes(user.id);

                const now = new Date();
                const midnight = new Date(now);
                midnight.setHours(24, 0, 0, 0);
                const timeUntilMidnight = midnight - now;

                const collector = message.createReactionCollector({ filter, time: timeUntilMidnight });

                const interval = setInterval(async () => {
                    const now = new Date();

                    if (now >= midnight) {
                        clearInterval(interval);
                        return;
                    }

                    const reactedUsers = [...collector.collected.values()]
                        .flatMap(r => r.users.cache.map(u => u.id));

                    if (reactedUsers.length > 0) {
                        await channel.send(`✅ 주간 보고서가 제출되었습니다.`);
                        clearInterval(interval);
                        collector.stop();
                    } else {
                        await channel.send({
                            content: `<@&${data[serverId].roleId}>\n🚨 주간 보고서를 아직 작성하지 않았어요!`,
                            allowedMentions: { parse: ["everyone"] }
                        });
                    }
                }, interval);
            }
        } catch (error) {
            console.error(`[!] 주간 메시지 전송 오류:`, error);
        }
    });

    return weeklyReport;
}


fs.watch(DATA_FILE, (eventType) => {
    if (eventType === 'change') {
        console.log('[🔄] 데이터 변경 감지 → 스케줄 다시 설정');
        scheduleMessages();
    }
});

client.once('ready', () => {
    console.log(`[!] 봇 로그인 완료: ${client.user.tag}`);
    client.guilds.cache.forEach(guild => addGuildToData(guild.id));
    scheduleMessages();
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;

    if (interaction.commandName === 'setup') {
        const team = interaction.options.getString('팀');
        const time = interaction.options.getInteger('시간');
        const channel = interaction.options.getChannel('채널');
        const role = interaction.options.getRole('역할');

        let data = readData();
        let serverId = interaction.guildId;

        const members = [];
        const fetchedMembers = await interaction.guild.members.fetch(); // 모든 멤버 불러오기

        // 역할을 가진 멤버만 필터링
        const roleMembers = fetchedMembers.filter(member => member.roles.cache.has(role.id));

        if (roleMembers.size > 0) {
            roleMembers.forEach(member => members.push(member.id));
        } else {
            console.log(`[⚠] ${role.name} 역할에 사용자가 없습니다.`);
        }

        console.log(members); // 가져온 멤버 목록 확인


        data[serverId] = {
            channelId: channel.id,
            Link: team,
            time: time,
            members: members,
            roleId: role.id
        };
        saveData(data);

        await interaction.reply({
            content: `✅ 설정 완료!\n팀: [링크](${team})\n공지 시간: ${time}시\n채널: <#${channel.id}>\n역할: <@&${role.id}>`,
        });
    }
    else if (interaction.commandName === 'clear') {

    }
    else if (interaction.commandName === 'notification') {
        let data = readData();
        const message = interaction.options.getString('메시지');

        const serverIds = Object.keys(data);

        for (const serverId of serverIds) {
            const roleId = data[serverId].roleId;
            const channelId = data[serverId].channelId;
            const guild = await client.guilds.fetch(channelId);
            const channel = await client.channels.fetch(channelId === null ? guild.systemChannel : channelId);

            const embed = new EmbedBuilder()
                .setColor(0x0099ff)
                .setTitle('🚨 업데이트 공지')
                .setDescription(message)
                .setTimestamp(new Date());

            await channel.send({
                content: `${roleId === null ? "" : `<@&${roleId}>`}`,
                embeds: [embed],
            });
        }

        await interaction.reply({
            content: `✅ 공지 완료!`,
        });
    }
    else if (interaction.commandName === 'suggestion') {
        const message = interaction.options.getString('메시지');
        const user = await client.users.fetch(806172778168189020); // 내 clientID

        await user.send(message);
    }
});

function addGuildToData(guildId) {
    const data = readData();
    if (!data[guildId]) {
        data[guildId] = {
            channelId: null,
            Link: null,
            time: null,
            members: [],
            roleId: null
        };

        saveData(data);
    }
}

client.on('guildCreate', async (guild) => {
    console.log(`[📥] ${guild.name} 서버에 초대됨 (id: ${guild.id})`);
    addGuildToData(guild.id);

    let channel = guild.systemChannel || guild.channels.cache.find(ch => ch.type === 0);

    if (channel) {
        channel.send("`/setup` 명령어를 통해 봇을 설정해주세요.");
    }
});

client.login(config.token);