// ==========================================
// キャラクター・敵データ定義（王道あんこキャラ版）
// ==========================================

const INITIAL_PLAYER_TEAM = [
    {
        id: "yaruo", name: "やる夫", aa: "CHARACTER.ORIGINAL.YARUO.通常", level: 1, levelExp: 0, sp: 0,
        trait: "mastery", skills: ["power_smash", "fire_slash", "snipe_shot"],
        maxHp: 120, hp: 120, tech: 65, exp: 35, baseDmg: 15, baseDef: 10, equip: "sw_1",
        maxShock: 80, maxHeat: 80, maxElec: 80, recShock: 10, recHeat: 10, recElec: 10, revShock: 2, revHeat: 2, revElec: 2, atkShock: 10, atkHeat: 5, atkElec: 5,
        aff_fire: "wk", aff_elec: "wk", aff_ice: "wk", aff_wind: "wk"
    },
    {
        id: "yaranaio", name: "やらない夫", aa: "CHARACTER.ORIGINAL.YARANAIO.通常", level: 5, levelExp: 0, sp: 0,
        trait: "insight", skills: ["snipe_shot", "stun_impact"],
        maxHp: 150, hp: 150, tech: 100, exp: 50, baseDmg: 20, baseDef: 15, equip: "sp_3",
        maxShock: 100, maxHeat: 100, maxElec: 100, recShock: 15, recHeat: 15, recElec: 15, revShock: 3, revHeat: 3, revElec: 3, atkShock: 5, atkHeat: 5, atkElec: 25
    },
    {
        id: "yaranaiko", name: "やらない子", aa: "CHARACTER.ORIGINAL.YARANAIKO.通常", level: 5, levelExp: 0, sp: 0,
        trait: "stealth", skills: ["power_smash", "snipe_shot"],
        maxHp: 130, hp: 130, tech: 80, exp: 80, baseDmg: 15, baseDef: 15, equip: "sw_5",
        maxShock: 90, maxHeat: 90, maxElec: 90, recShock: 12, recHeat: 12, recElec: 12, revShock: 2, revHeat: 2, revElec: 2, atkShock: 15, atkHeat: 15, atkElec: 15
    }
];

// チュートリアルの全段階に対応できるよう敵の種類を拡充
let ENEMY_MASTER = {
    // 王道モンスター（チュートリアル用）
    "スライム": {
        name: "スライム", aa: "CHARACTER.ORIGINAL.SLIME.通常", maxHp: 40, hp: 40, tech: 10, exp: 5, baseDmg: 5, baseDef: 0,
        dropMoney: 50, dropExp: 30, dropItem: "heal_1", dropRate: 50, trait: "lucky", skills: [""],
        maxShock: 10, maxHeat: 10, maxElec: 10, recShock: 5, recHeat: 5, recElec: 5, revShock: 2, revHeat: 2, revElec: 2, atkShock: 5, atkHeat: 5, atkElec: 5,
    },
    "ゴブリン": {
        name: "ゴブリン", aa: "CHARACTER.ORIGINAL.GOBLIN.通常", maxHp: 80, hp: 80, tech: 20, exp: 15, baseDmg: 10, baseDef: 3,
        dropMoney: 100, dropExp: 80, dropItem: "mat_powder",  dropRate: 20, trait: "stealth", skills: ["power_smash"],
        maxShock: 50, maxHeat: 18, maxElec: 50, recShock: 5, recHeat: 5, recElec: 5, revShock: 2, revHeat: 4, revElec: 2, atkShock: 10, atkHeat: 10, atkElec: 10
    },
    "ねらう緒": {
        name: "ねらう緒", aa: "CHARACTER.ORIGINAL.NERAUO.通常", maxHp: 100, hp: 100, tech: 10, exp: 10, baseDmg: 10, baseDef: 5,
        dropMoney: 50, dropExp: 30, trait: "lucky", skills: [""],
        maxShock: 50, maxHeat: 50, maxElec: 50, recShock: 5, recHeat: 5, recElec: 5, revShock: 2, revHeat: 2, revElec: 2, atkShock: 5, atkHeat: 5, atkElec: 5
    },
    "隠れ奈": {
        name: "隠れ奈", aa: "CHARACTER.ORIGINAL.KAKURENA.通常", maxHp: 110, hp: 110, tech: 30, exp: 30, baseDmg: 15, baseDef: 10,
        dropMoney: 100, dropExp: 80, trait: "stealth", skills: ["power_smash"],
        maxShock: 60, maxHeat: 30, maxElec: 60, recShock: 5, recHeat: 5, recElec: 5, revShock: 2, revHeat: 2, revElec: 2, atkShock: 10, atkHeat: 10, atkElec: 10
    },
    "ドクオ": {
        name: "ドクオ", aa: "CHARACTER.ORIGINAL.DOKUO.通常", maxHp: 90, hp: 90, tech: 40, exp: 10, baseDmg: 15, baseDef: 8,
        dropMoney: 300, dropExp: 200,
        trait: "infection", // 触ると状態異常がうつる
        skills: ["fire_slash"], // 火傷を狙ってくる
        maxShock: 50, maxHeat: 50, maxElec: 50, recShock: 10, recHeat: 10, recElec: 10, revShock: 3, revHeat: 3, revElec: 3, atkShock: 10, atkHeat: 20, atkElec: 0,
        aff_fire: "wk", aff_elec: "rs" // 火に弱く電撃に強い
    },
    "できない夫": {
        name: "できない夫", aa: "CHARACTER.ORIGINAL.DEKINAIO.通常", maxHp: 140, hp: 140, tech: 30, exp: 20, baseDmg: 3, baseDef: 16,
        trait: "sturdy", // 硬いタンク役
        dropMoney: 400, dropExp: 250, skills: ["power_smash"],
        maxShock: 150, maxHeat: 150, maxElec: 150, recShock: 15, recHeat: 15, recElec: 15, revShock: 1, revHeat: 1, revElec: 1, atkShock: 30, atkHeat: 0, atkElec: 0
    },
    "悪魔やる夫": {
        name: "悪魔やる夫", aa: "CHARACTER.ORIGINAL.AKUMAYARUO.通常", maxHp: 150, hp: 150, tech: 50, exp: 30, baseDmg: 25, baseDef: 0,
        trait: "preemptive", // 先制して大ダメージを狙ってくるアタッカー
        dropMoney: 500, dropExp: 350, skills: ["snipe_shot"],
        maxShock: 80, maxHeat: 80, maxElec: 80, recShock: 10, recHeat: 10, recElec: 10, revShock: 2, revHeat: 2, revElec: 2, atkShock: 10, atkHeat: 30, atkElec: 30,
        aff_dark: "ab", aff_light: "wk" // 闇吸収、光弱点
    },
    "できる夫": {
        name: "できる夫", aa: "CHARACTER.ORIGINAL.DEKIRUO.通常", maxHp: 300, hp: 300, tech: 50, exp: 50, baseDmg: 20, baseDef: 10,
        dropMoney: 1000, dropExp: 500, trait: "strategist", isBoss: "true", skills: ["stun_impact"],
        maxShock: 200, maxHeat: 200, maxElec: 200, recShock: 20, recHeat: 20, recElec: 20, revShock: 1, revHeat: 1, revElec: 1, atkShock: 20, atkHeat: 20, atkElec: 20
    }
};
