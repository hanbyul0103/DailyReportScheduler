enum JobType {
    Warrior = "전사",
    Wizard = "마법사",
    Archer = "궁수"
}

enum ItemType {
    Weapon = "무기",
    Armor = "방어구",
    Consumable = "소비아이템"
}

enum ItemName {
    HPPotion = "HP potion",
}

class User {
    email: string
    nickname: string
    characters: Character[];

    constructor(email: string, nickname: string, characters: Character[] = []) {
        this.email = email;
        this.nickname = nickname;
        this.characters = characters;
    }
}

class Character {
    name: string
    job: JobType
    level: number
    exp: number
    inventory: Item[];

    constructor(name: string, job: JobType, level: number, exp: number, inventory: Item[] = []) {
        this.name = name;
        this.job = job;
        this.level = level;
        this.exp = exp;
        this.inventory = inventory;
    }

    gainExp(amount: number) {
        this.exp += amount;

        while (this.exp >= 100) {
            this.level += 1;
            this.exp -= 100;

            console.log(`현재 레벨 ${this.level}\n현재 경험치 ${this.exp}`);
        }
    }

    useItem(itemName: ItemName) {
        const item = this.inventory.find(i => i.name === itemName);

        if (!item) return;
        if (!(item instanceof Consumable)) return;

        item.quantity -= 1;

        if (item.quantity <= 0) {
            this.inventory = this.inventory.filter(i => i !== item);
        }
    }

    addItem(item: Item) {
        const existing = this.inventory.find(i => i.name === item.name && i.constructor === item.constructor);
        if (existing) {
            existing.quantity += item.quantity;
        } else {
            this.inventory.push(item);
        }
    }
}

abstract class Item {
    name: string
    itemType: ItemType
    quantity: number

    constructor(name: string, itemType: ItemType, quantity: number) {
        this.name = name;
        this.itemType = itemType;
        this.quantity = quantity;
    }
}

class Weapon extends Item {
    constructor(name: string, quantity: number) {
        super(name, ItemType.Weapon, quantity);
    }
}

class Armor extends Item {
    constructor(name: string, quantity: number) {
        super(name, ItemType.Armor, quantity);
    }
}

class Consumable extends Item {
    duration: number;

    constructor(name: string, quantity: number, duration: number) {
        super(name, ItemType.Consumable, quantity);
        this.duration = duration;
    }
}

function Main() {
    const char1 = new Character("아처1", JobType.Archer, 1, 0, []);
    char1.gainExp(230);

    char1.addItem(new Consumable(ItemName.HPPotion, 2, 5));
    char1.useItem(ItemName.HPPotion);
    char1.useItem(ItemName.HPPotion);
}