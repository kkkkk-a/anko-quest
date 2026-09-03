const SKILLS = {
    // === 基本・物理技 ===
    "power_smash": {
        id: "power_smash",
        name: "パワースマッシュ",
        desc: "渾身の力で叩き伏せる。ダメージ1.5倍。衝撃耐性を大きく削る。",
        atk_element: "fight",
        dmg_mod: 1.5,
        hit_dice_mod: -1,
        mod_shock: 2.0,
        cost_mp: 0,
        cost_st: 15,
        recoil_hp: 25,  
        recoil_shock: 25,     
        recoil_heat: 25,     
    },
    "snipe_shot": {
        id: "snipe_shot",
        name: "狙い撃ち",
        desc: "風を読み急所を貫く。命中率が極めて高く、ダメージも1.3倍に向上。",
        atk_element: "wind",
        dmg_mod: 1.3,
        hit_dice_mod: 4,
        cost_mp: 0,
        cost_st: 10,
    },

    // === 属性特化技 ===
    "fire_slash": {
        id: "fire_slash",
        name: "ファイアスラッシュ",
        desc: "烈火の刃で切り裂く。熱量削りが高く、高確率で相手を【火傷】させる。",
        atk_element: "fire",
        dmg_mod: 1.6,
        mod_heat: 3.0,
        add_heat: 10,
        cost_mp: 10,
        cost_st: 10,
        inflict_status: "burn"
    },
    "stun_impact": {
        id: "stun_impact",
        name: "スタンインパクト",
        desc: "高圧電流を帯びた衝撃。衝撃・電磁を削り、相手を【麻痺】させることがある。",
        atk_element: "elec",
        dmg_mod: 1.4,
        mod_shock: 1.5,
        mod_elec: 2.0,
        cost_mp: 10,
        cost_st: 10,
        inflict_status: "paralysis"
    },
    
    // === ハイリスク・ハイリターン ===
    "desperate_blow": {
        id: "desperate_blow",
        name: "捨て身の一撃",
        desc: "命を賭した特攻。ダメージ2.5倍の超威力だが、自身もHPの25%を失う。",
        atk_element: "fight",
        dmg_mod: 2.5,
        cost_mp: 0,
        cost_st: 25,
        recoil_hp: 25,
    },
    "overload": {
        id: "overload",
        name: "オーバーロード",
        desc: "回路を焼き切る極大電撃。電磁耐性を一撃で破壊し得る。反動も甚大。",
        atk_element: "elec",
        dmg_mod: 1.8,
        mod_elec: 4.0,
        cost_mp: 25,
        cost_st: 10,
        recoil_shock: 30,
        recoil_heat: 30,
        recoil_elec: 30,
    },
    "gamble_hit": {
        id: "gamble_hit",
        name: "ギャンブルヒット",
        desc: "運命を天に任せる。戦闘ダイスが2倍になるが、外した時の隙も大きい。",
        atk_element: "spirit",
        dmg_mod: 1.5,
        battle_dice_mod: 2.0,
        cost_mp: 5,
        cost_st: 5
    },
};