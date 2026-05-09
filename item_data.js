// ==========================================
// アイテム・装備データ定義（自動AA割り当て版）
// ==========================================

const ITEMS = {
    // ---------------------------------------------------------
    // 消耗品 (Consumables)
    // ---------------------------------------------------------
    heal_1: { id: "heal_1", type: "consumable", effect: "heal", effectPower: 20, name: "薬草", price: 10, desc: "HPを20回復する。" },
heal_2: { id: "heal_2", type: "consumable", effect: "heal", effectPower: 50, name: "キズぐすり", price: 30, recipe: "heal_1:1", desc: "薬草を加工した薬品。HPを50回復する。" },
    heal_3: { id: "heal_3", type: "consumable", effect: "heal", effectPower: 100, name: "高級ポーション", price: 80, desc: "HPを100回復する。" },
    heal_4: { id: "heal_4", type: "consumable", effect: "heal", effectPower: 9999, name: "エリクサー", price: 300, desc: "HPを全回復する。" },
    
    coolant_1: { id: "coolant_1", type: "consumable", effect: "rec_res", name: "冷却スプレー", price: 20, desc: "熱量耐性を回復。" },
    coolant_2: { id: "coolant_2", type: "consumable", effect: "rec_res", name: "急速冷却剤", price: 60, desc: "全耐性を復旧・全回復。" },
    
    battery_1: { id: "battery_1", type: "consumable", effect: "rec_res", name: "小型電池", price: 20, desc: "電磁耐性を回復。" },
    battery_2: { id: "battery_2", type: "consumable", effect: "rec_res", name: "大容量バッテリー", price: 70, desc: "電磁耐性を最大まで復旧。" },

    smoke_1: { id: "smoke_1", type: "consumable", effect: "escape", name: "煙玉", price: 50, desc: "戦闘から確実に逃走する。" },
    
    sniper_1: { id: "sniper_1", type: "consumable", effect: "transform_crit", name: "狙撃の薬", price: 100, desc: "次攻撃が命中時クリティカル。" },
    surehit_1: { id: "surehit_1", type: "consumable", effect: "guarantee_hit", name: "必中の薬", price: 100, desc: "次攻撃が確実に命中する。" },
    decoy_1: { id: "decoy_1", type: "consumable", effect: "guarantee_dodge", name: "身代わり人形", price: 80, desc: "次の被弾を1度無効化。" },
    counter_1: { id: "counter_1", type: "consumable", effect: "counter", name: "反撃の符", price: 120, desc: "使用ターン、カウンター発動。" },
    
    buff_atk_1: { id: "buff_atk_1", type: "consumable", effect: "buff", effectPower: 20, name: "力の種", price: 150, desc: "この戦闘中、全能力+20。" },
    buff_atk_2: { id: "buff_atk_2", type: "consumable", effect: "buff", effectPower: 50, name: "闘神の丸薬", price: 300, desc: "この戦闘中、全能力+50。" },
    
    bomb_1: { id: "bomb_1", type: "consumable", effect: "damage_fixed", effectPower: 30, name: "手投げ弾", price: 40, desc: "敵に固定30ダメージ。" },
    bomb_2: { id: "bomb_2", type: "consumable", effect: "damage_fixed", effectPower: 100, name: "メガバズーカ", price: 200, desc: "敵に固定100ダメージ。" },

    insulate_1: { id: "insulate_1", type: "consumable", effect: "res_up", name: "絶縁シート", price: 40, desc: "電磁耐性の減少を抑える。" },
    oil_1: { id: "oil_1", type: "consumable", effect: "res_up", name: "潤滑油", price: 40, desc: "衝撃耐性の減少を抑える。" },

    // ---------------------------------------------------------
    // 剣・鋭器系 (Swords/Blades)
    // ---------------------------------------------------------
    sw_0: { id: "sw_0", type: "equip", name: "錆びた短剣", price: 0, addTech: -5, addExp: 0, addDmg: 1, addDef: 0, atkShock: 2, atkHeat: 0, atkElec: 0, desc: "ボロボロのナイフ。" },
    sw_1: { id: "sw_1", type: "equip", name: "ブロンズソード", price: 50, addTech: 5, addExp: 0, addDmg: 4, addDef: 0, atkShock: 5, atkHeat: 0, atkElec: 0, desc: "安価な青銅の剣。" },
    sw_2: { id: "sw_2", type: "equip", name: "アイアンブレード", price: 120, addTech: 10, addExp: 0, addDmg: 8, addDef: 0, atkShock: 8, atkHeat: 0, atkElec: 0, desc: "鉄製の標準的な剣。" },
    sw_3: { id: "sw_3", type: "equip", name: "鋼鉄のロングソード", price: 250, addTech: 15, addExp: 0, addDmg: 12, addDef: 0, atkShock: 10, atkHeat: 0, atkElec: 0, desc: "鍛えられた鋼の剣。" },
    sw_4: { id: "sw_4", type: "equip", name: "名刀『村正』", price: 500, addTech: 40, addExp: -10, addDmg: 25, addDef: -5, atkShock: 15, atkHeat: 0, atkElec: 0, desc: "高い技術補正を持つ妖刀。" },
    sw_5: { id: "sw_5", type: "equip", name: "ミスリルレイピア", price: 700, addTech: 50, addExp: 10, addDmg: 18, addDef: 2, atkShock: 5, atkHeat: 0, atkElec: 5, desc: "魔力を帯びた軽量の細剣。" },
    sw_6: { id: "sw_6", type: "equip", name: "オリハルコンの剣", price: 1200, addTech: 30, addExp: 30, addDmg: 40, addDef: 10, atkShock: 20, atkHeat: 10, atkElec: 10, desc: "伝説の金属で作られた神剣。" },
    sw_7: { id: "sw_7", type: "equip", name: "アサシンダガー", price: 300, addTech: 25, addExp: 5, addDmg: 10, addDef: 0, atkShock: 2, atkHeat: 0, atkElec: 0, desc: "不意打ちに適した短剣。" },
    sw_8: { id: "sw_8", type: "equip", name: "炎のフランベルジュ", price: 450, addTech: 10, addExp: 0, addDmg: 15, addDef: 0, atkShock: 5, atkHeat: 25, atkElec: 0, atk_element: "fire", desc: "刃が波打つ熱を帯びた剣。" },
    sw_9: { id: "sw_9", type: "equip", name: "氷結のサーベル", price: 450, addTech: 10, addExp: 10, addDmg: 12, addDef: 5, atkShock: 5, atkHeat: -10, atkElec: 0, atk_element: "ice", desc: "敵を凍てつかせる魔剣。" },
    sw_10: { id: "sw_10", type: "equip", name: "雷電のカタナ", price: 600, addTech: 35, addExp: 0, addDmg: 15, addDef: 0, atkShock: 10, atkHeat: 0, atkElec: 30, atk_element: "elec", desc: "紫電を纏う東方の刀。" },
    sw_11: { id: "sw_11", type: "equip", name: "竜殺しの大剣", price: 900, addTech: -10, addExp: 10, addDmg: 50, addDef: 5, atkShock: 40, atkHeat: 15, atkElec: 0, desc: "巨大な竜を両断する剛剣。" },
    sw_12: { id: "sw_12", type: "equip", name: "聖剣エクスカリバー", price: 2500, addTech: 60, addExp: 60, addDmg: 80, addDef: 20, atkShock: 30, atkHeat: 30, atkElec: 30, atk_element: "light", desc: "最強の聖剣。全能力を極限まで高める。" },
    sw_13: { id: "sw_13", type: "equip", name: "魔剣グラム", price: 2200, addTech: 80, addExp: -20, addDmg: 90, addDef: -10, atkShock: 50, atkHeat: 50, atkElec: 0, atk_element: "dark", desc: "破滅を運ぶ魔剣。技術補正が凄まじい。" },
    sw_14: { id: "sw_14", type: "equip", name: "木刀", price: 10, addTech: 5, addExp: 15, addDmg: 2, addDef: 0, atkShock: 15, atkHeat: 0, atkElec: 0, desc: "修行用の刀。衝撃はそれなり。" },
    sw_15: { id: "sw_15", type: "equip", name: "三日月宗近", price: 800, addTech: 45, addExp: 20, addDmg: 30, addDef: 5, atkShock: 10, atkHeat: 0, atkElec: 0, desc: "美しく鋭い天下五剣の一つ。" },
    sw_16: { id: "sw_16", type: "equip", name: "竹光", price: 1, addTech: 20, addExp: -20, addDmg: 1, addDef: 0, atkShock: 1, atkHeat: 0, atkElec: 0, desc: "ただの竹。ハッタリ用。" },
    sw_17: { id: "sw_17", type: "equip", name: "レーザーカッター", price: 550, addTech: 20, addExp: 0, addDmg: 20, addDef: 0, atkShock: 5, atkHeat: 45, atkElec: 10, desc: "高出力レーザーで物体を切断する。" },
    sw_18: { id: "sw_18", type: "equip", name: "チェーンソー", price: 400, addTech: -15, addExp: 0, addDmg: 35, addDef: 0, atkShock: 35, atkHeat: 10, atkElec: 0, desc: "唸るエンジン。無慈悲な切断。" },
    sw_19: { id: "sw_19", type: "equip", name: "光子剣", price: 1500, addTech: 70, addExp: 10, addDmg: 55, addDef: 0, atkShock: 10, atkHeat: 60, atkElec: 60, desc: "光子で構成された刃。装甲を無視する。" },

    // ---------------------------------------------------------
    // 斧・槌系 (Axes/Hammers)
    // ---------------------------------------------------------
    ax_1: { id: "ax_1", type: "equip", name: "石の斧", price: 40, addTech: -10, addExp: 0, addDmg: 6, addDef: 0, atkShock: 15, atkHeat: 0, atkElec: 0, desc: "原始的な斧。" },
    ax_2: { id: "ax_2", type: "equip", name: "鉄のバトルアクス", price: 150, addTech: -5, addExp: 0, addDmg: 15, addDef: 0, atkShock: 25, atkHeat: 0, atkElec: 0, desc: "戦闘用の重い斧。" },
    ax_3: { id: "ax_3", type: "equip", name: "ウォーハンマー", price: 200, addTech: -10, addExp: 5, addDmg: 12, addDef: 2, atkShock: 45, atkHeat: 0, atkElec: 0, desc: "衝撃を与えることに特化した槌。" },
    ax_4: { id: "ax_4", type: "equip", name: "フランキスカ", price: 320, addTech: 5, addExp: 0, addDmg: 18, addDef: 0, atkShock: 20, atkHeat: 0, atkElec: 0, desc: "投げ斧としても使える軽量の斧。" },
    ax_5: { id: "ax_5", type: "equip", name: "大槌『グラットン』", price: 500, addTech: -30, addExp: 10, addDmg: 35, addDef: 10, atkShock: 80, atkHeat: 0, atkElec: 0, desc: "凄まじい質量。衝撃ブレイク確実。" },
    ax_6: { id: "ax_6", type: "equip", name: "地烈の斧", price: 650, addTech: -10, addExp: 0, addDmg: 40, addDef: 5, atkShock: 55, atkHeat: 0, atkElec: 0, desc: "大地を砕く衝撃波を放つ。" },
    ax_7: { id: "ax_7", type: "equip", name: "フレイムアクス", price: 550, addTech: -5, addExp: 0, addDmg: 25, addDef: 0, atkShock: 30, atkHeat: 40, atkElec: 0, desc: "熱量ダメージを併せ持つ熱い斧。" },
    ax_8: { id: "ax_8", type: "equip", name: "電磁インパクト", price: 800, addTech: 0, addExp: 10, addDmg: 20, addDef: 0, atkShock: 60, atkHeat: 0, atkElec: 50, desc: "衝撃と電磁を同時に流し込む重装備。" },
    ax_9: { id: "ax_9", type: "equip", name: "ブラッドアクス", price: 900, addTech: 10, addExp: -20, addDmg: 60, addDef: -10, atkShock: 40, atkHeat: 0, atkElec: 0, desc: "血を吸う呪われた斧。破壊力は絶大。" },
    ax_10: { id: "ax_10", type: "equip", name: "巨人の棍棒", price: 400, addTech: -40, addExp: 20, addDmg: 50, addDef: 0, atkShock: 100, atkHeat: 0, atkElec: 0, desc: "技術は最低だが衝撃はMAX。" },
    ax_11: { id: "ax_11", type: "equip", name: "パイルバンカー改", price: 1500, addTech: -20, addExp: 10, addDmg: 80, addDef: 5, atkShock: 150, atkHeat: 30, atkElec: 0, desc: "近接最強の衝撃兵器。装甲を貫く。" },
    ax_12: { id: "ax_12", type: "equip", name: "トールハンマー", price: 2000, addTech: 20, addExp: 30, addDmg: 70, addDef: 15, atkShock: 90, atkHeat: 0, atkElec: 120, desc: "雷神の槌。敵を逃がさず砕く。" },
    ax_13: { id: "ax_13", type: "equip", name: "モーニングスター", price: 350, addTech: -5, addExp: 5, addDmg: 20, addDef: 0, atkShock: 40, atkHeat: 0, atkElec: 0, desc: "刺付きの鉄球。衝撃が分散しない。" },
    ax_14: { id: "ax_14", type: "equip", name: "デスサイズ", price: 1100, addTech: 30, addExp: -10, addDmg: 55, addDef: 0, atkShock: 10, atkHeat: 0, atkElec: 0, desc: "巨大な鎌。クリティカル率が高い。" },
    ax_15: { id: "ax_15", type: "equip", name: "ミートチョッパー", price: 280, addTech: 0, addExp: 0, addDmg: 22, addDef: 0, atkShock: 20, atkHeat: 0, atkElec: 0, desc: "肉を断つための巨大な包丁。" },
    ax_16: { id: "ax_16", type: "equip", name: "ハルバード", price: 480, addTech: 15, addExp: 5, addDmg: 28, addDef: 5, atkShock: 25, atkHeat: 0, atkElec: 0, desc: "斧と槍の機能を備えた長柄武器。" },
    ax_17: { id: "ax_17", type: "equip", name: "プラズマハンマー", price: 1300, addTech: -5, addExp: 10, addDmg: 45, addDef: 0, atkShock: 70, atkHeat: 40, atkElec: 80, desc: "超高熱のプラズマを発生させる槌。" },
    ax_18: { id: "ax_18", type: "equip", name: "隕石の斧", price: 1800, addTech: -15, addExp: 20, addDmg: 100, addDef: 10, atkShock: 120, atkHeat: 50, atkElec: 0, desc: "宇宙から降り注いだ金属の斧。" },
    ax_19: { id: "ax_19", type: "equip", name: "パワーレンチ", price: 150, addTech: 5, addExp: 10, addDmg: 10, addDef: 0, atkShock: 30, atkHeat: 0, atkElec: 0, desc: "整備用の大きな工具。意外と強い。" },
    ax_20: { id: "ax_20", type: "equip", name: "ドリルアーム", price: 1400, addTech: -10, addExp: 0, addDmg: 65, addDef: 15, atkShock: 110, atkHeat: 20, atkElec: 20, desc: "回転の力ですべてを貫く。" },

    // ---------------------------------------------------------
    // 特殊・サイバー・魔導具系 (Special/Tech)
    // ---------------------------------------------------------
    sp_1: { id: "sp_1", type: "equip", name: "マジックワンド", price: 100, addTech: 10, addExp: 20, addDmg: 5, addDef: 0, atkShock: 0, atkHeat: 10, atkElec: 10, desc: "魔導を補助する杖。" },
    sp_2: { id: "sp_2", type: "equip", name: "火炎放射器", price: 400, addTech: -10, addExp: 0, addDmg: 15, addDef: 0, atkShock: 0, atkHeat: 60, atkElec: 0, atk_element: "fire", inflict_status: "burn", desc: "熱量攻撃特化。たまに火傷させる。" },
    sp_3: { id: "sp_3", type: "equip", name: "スタンガン", price: 350, addTech: 20, addExp: 0, addDmg: 5, addDef: 0, atkShock: 5, atkHeat: 0, atkElec: 65, atk_element: "elec", inflict_status: "paralysis", desc: "電磁攻撃特化。たまに麻痺させる。" },
    sp_4: { id: "sp_4", type: "equip", name: "プラズマライフル", price: 800, addTech: 30, addExp: 0, addDmg: 30, addDef: 0, atkShock: 10, atkHeat: 40, atkElec: 40, range: 3, desc: "射程3。バランスの良いサイバー兵器。" },
    sp_5: { id: "sp_5", type: "equip", name: "レールガン", price: 1800, addTech: 100, addExp: 0, addDmg: 60, addDef: -10, atkShock: 80, atkHeat: 20, atkElec: 100, atk_element: "elec", desc: "超電磁加速砲。回避不能の威力。" },
    sp_6: { id: "sp_6", type: "equip", name: "大賢者の杖", price: 1200, addTech: 20, addExp: 80, addDmg: 20, addDef: 10, atkShock: 0, atkHeat: 40, atkElec: 40, desc: "古の知恵が宿る杖。経験が大幅上昇。" },
    sp_7: { id: "sp_7", type: "equip", name: "テスラコイル", price: 700, addTech: 10, addExp: 0, addDmg: 10, addDef: 5, atkShock: 0, atkHeat: 0, atkElec: 90, desc: "常に放電を繰り返す装置。" },
    sp_8: { id: "sp_8", type: "equip", name: "ソニックブーム", price: 500, addTech: 40, addExp: 10, addDmg: 15, addDef: 0, atkShock: 60, atkHeat: 0, atkElec: 0, desc: "高周波振動で衝撃を与える。" },
    sp_9: { id: "sp_9", type: "equip", name: "暗黒の魔導書", price: 1100, addTech: 50, addExp: -30, addDmg: 70, addDef: -20, atkShock: 20, atkHeat: 40, atkElec: 40, atk_element: "dark", desc: "代償に大きなダメージをもたらす書。" },
    sp_10: { id: "sp_10", type: "equip", name: "聖なる福音", price: 1100, addTech: 10, addExp: 70, addDmg: 10, addDef: 30, atkShock: 0, atkHeat: 0, atkElec: 0, atk_element: "light", desc: "防御と経験を高める聖典。" },
    sp_11: { id: "sp_11", type: "equip", name: "ドローンリモコン", price: 600, addTech: 30, addExp: 30, addDmg: 15, addDef: 0, atkShock: 10, atkHeat: 10, atkElec: 30, desc: "遠隔ドローンで攻撃を支援する。" },
    sp_12: { id: "sp_12", type: "equip", name: "毒針", price: 200, addTech: 60, addExp: -10, addDmg: 5, addDef: 0, atkShock: 0, atkHeat: 5, atkElec: 0, inflict_status: "poison", desc: "たまに相手を猛毒にする。" },
    sp_13: { id: "sp_13", type: "equip", name: "ヒートホーク", price: 750, addTech: -5, addExp: 0, addDmg: 35, addDef: 0, atkShock: 40, atkHeat: 70, atkElec: 0, atk_element: "fire", desc: "赤熱化した刃で焼き切る斧。" },
    sp_14: { id: "sp_14", type: "equip", name: "重力波発生器", price: 1600, addTech: -10, addExp: 40, addDmg: 50, addDef: 20, atkShock: 120, atkHeat: 0, atkElec: 0, desc: "重力を操り敵を押し潰す。" },
    sp_15: { id: "sp_15", type: "equip", name: "EMPジェネレーター", price: 1400, addTech: 10, addExp: 10, addDmg: 20, addDef: 5, atkShock: 20, atkHeat: 0, atkElec: 150, desc: "広範囲電磁パルス。電子機器に致命的。" },
    sp_16: { id: "sp_16", type: "equip", name: "メルトダウン砲", price: 2000, addTech: -20, addExp: 0, addDmg: 100, addDef: -30, atkShock: 50, atkHeat: 200, atkElec: 0, atk_element: "fire", desc: "制御不能の熱量。すべてを溶かす。" },
    sp_17: { id: "sp_17", type: "equip", name: "ナノマシン射出機", price: 950, addTech: 20, addExp: 20, addDmg: 15, addDef: 15, atkShock: 10, atkHeat: 10, atkElec: 10, desc: "味方の支援も可能な汎用メカ。" },
    sp_18: { id: "sp_18", type: "equip", name: "零式レーザー", price: 2200, addTech: 120, addExp: 40, addDmg: 70, addDef: 0, atkShock: 20, atkHeat: 100, atkElec: 100, desc: "究極の光学兵器。" },
    sp_19: { id: "sp_19", type: "equip", name: "おもちゃの銃", price: 5, addTech: 10, addExp: -5, addDmg: 1, addDef: 0, atkShock: 1, atkHeat: 0, atkElec: 0, desc: "BB弾が出るだけ。" },
    sp_20: { id: "sp_20", type: "equip", name: "爆散スイッチ", price: 3000, addTech: -50, addExp: -50, addDmg: 250, addDef: -100, atkShock: 200, atkHeat: 200, atkElec: 200, atk_element: "bomb", desc: "使用者の命と引き換えの超威力。" },

    // ---------------------------------------------------------
    // 防具・防壁・アクセサリ (Armor/Shields)
    // ---------------------------------------------------------
    df_1: { id: "df_1", type: "equip", name: "鍋の蓋", price: 10, addTech: 0, addExp: 0, addDmg: 0, addDef: 2, atkShock: 0, atkHeat: 0, atkElec: 0, desc: "気休めの防御。" },
    df_2: { id: "df_2", type: "equip", name: "木の盾", price: 50, addTech: 0, addExp: 5, addDmg: 0, addDef: 5, atkShock: 0, atkHeat: 0, atkElec: 0, desc: "木製の盾。" },
    df_3: { id: "df_3", type: "equip", name: "鉄の盾", price: 150, addTech: -2, addExp: 10, addDmg: 0, addDef: 12, atkShock: 5, atkHeat: 0, atkElec: 0, desc: "しっかりとした鉄の盾。" },
    df_4: { id: "df_4", type: "equip", name: "カイトシールド", price: 300, addTech: 0, addExp: 15, addDmg: 0, addDef: 20, atkShock: 8, atkHeat: 0, atkElec: 0, desc: "防御面積の広い盾。" },
    df_5: { id: "df_5", type: "equip", name: "騎士の鎧", price: 500, addTech: -10, addExp: 20, addDmg: 0, addDef: 35, atkShock: 0, atkHeat: 0, atkElec: 0, desc: "重厚な金属の鎧。" },
    df_6: { id: "df_6", type: "equip", name: "隠密の装束", price: 400, addTech: 30, addExp: 10, addDmg: 5, addDef: 10, atkShock: 0, atkHeat: 0, atkElec: 0, desc: "動きやすさを重視した服。" },
    df_7: { id: "df_7", type: "equip", name: "耐熱ジャケット", price: 450, addTech: 0, addExp: 10, addDmg: 0, addDef: 15, addMaxHeat: 50, aff_fire: "rs", desc: "熱量攻撃に強く、火炎属性を半減する。" },
    df_8: { id: "df_8", type: "equip", name: "耐雷スーツ", price: 450, addTech: 0, addExp: 10, addDmg: 0, addDef: 15, addMaxElec: 50, aff_elec: "rs", desc: "電磁攻撃に強く、電撃属性を半減する。" },
    df_9: { id: "df_9", type: "equip", name: "リアクティブアーマー", price: 800, addTech: -20, addExp: 20, addDmg: 0, addDef: 60, atkShock: 30, atkHeat: 10, atkElec: 0, desc: "爆発に反応して防御する装甲。" },
    df_10: { id: "df_10", type: "equip", name: "魔導障壁ジェネレーター", price: 1200, addTech: 10, addExp: 50, addDmg: 0, addDef: 50, atkShock: 10, atkHeat: 10, atkElec: 10, desc: "常にバリアを展開する。" },
    df_11: { id: "df_11", type: "equip", name: "セラミックプレート", price: 600, addTech: -5, addExp: 10, addDmg: 0, addDef: 40, addMaxHeat: 30, addMaxElec: 30, desc: "近代的な耐熱・耐雷装甲。" },
    df_12: { id: "df_12", type: "equip", name: "タワーシールド", price: 700, addTech: -25, addExp: 40, addDmg: 0, addDef: 70, atkShock: 50, atkHeat: 0, atkElec: 0, desc: "壁のような巨大な盾。" },
    df_13: { id: "df_13", type: "equip", name: "聖なる守り", price: 1000, addTech: 20, addExp: 20, addDmg: 0, addDef: 30, atkShock: 10, atkHeat: 10, atkElec: 10, desc: "神の加護を受けるお守り。" },
    df_14: { id: "df_14", type: "equip", name: "呪いの指輪", price: 10, addTech: -50, addExp: -50, addDmg: 50, addDef: -50, atkShock: 20, atkHeat: 20, atkElec: 20, desc: "強大な攻撃力を得る代わりに全てを失う。" },
    df_15: { id: "df_15", type: "equip", name: "パワー増幅グローブ", price: 350, addTech: 10, addExp: 0, addDmg: 15, addDef: 5, atkShock: 10, atkHeat: 0, atkElec: 5, desc: "腕力を強化する手袋。" },
    df_16: { id: "df_16", type: "equip", name: "スピードブーツ", price: 350, addTech: 40, addExp: 5, addDmg: 0, addDef: 2, atkShock: 0, atkHeat: 0, atkElec: 0, desc: "素早い動きを可能にする靴。" },
    df_17: { id: "df_17", type: "equip", name: "金塊の首飾り", price: 2000, addTech: -10, addExp: -10, addDmg: 0, addDef: 5, atkShock: 0, atkHeat: 0, atkElec: 0, desc: "ただ重くて豪華なだけ。換金用？" },
    df_18: { id: "df_18", type: "equip", name: "ドラゴンスケイル", price: 1800, addTech: 0, addExp: 30, addDmg: 10, addDef: 80, addMaxHeat: 100, aff_fire: "ab", desc: "竜の鱗。熱量を遮断し、火炎を吸収する。" },
    df_19: { id: "df_19", type: "equip", name: "フォースフィールド", price: 2500, addTech: 20, addExp: 50, addDmg: 0, addDef: 100, atkShock: 50, atkHeat: 50, atkElec: 50, desc: "あらゆる干渉を拒絶する絶対防御空間。" },
    df_20: { id: "df_20", type: "equip", name: "ふんどし", price: 100, addTech: 100, addExp: -100, addDmg: 10, addDef: -100, atkShock: 50, atkHeat: 0, atkElec: 0, desc: "防御を捨てた者の正装。技術が極限まで高まる。" },

    // ---------------------------------------------------------
    // オート発動・使い捨て装備 (Auto-Trigger Equips)
    // ---------------------------------------------------------
    focus_sash: { id: "focus_sash", type: "equip", name: "きあいのタスキ", price: 200, auto_trigger: "on_death", desc: "HPが0になる時、1残して耐え、壊れる。" },
    emergency_purge: { id: "emergency_purge", type: "equip", name: "緊急パージキット", price: 150, auto_trigger: "on_break", inflict_status: "fragile", desc: "ブレイク時、全耐性を復旧するが自身が脆弱になる。" },
    shock_absorber: { id: "shock_absorber", type: "equip", name: "衝撃吸収材", price: 50, auto_trigger: "on_break_shock", desc: "衝撃ブレイク時、衝撃耐性のみ全快して壊れる。" },
    heat_absorber: { id: "heat_absorber", type: "equip", name: "熱量吸収材", price: 50, auto_trigger: "on_break_heat", desc: "熱量ブレイク時、熱量耐性のみ全快して壊れる。" },
    elec_absorber: { id: "elec_absorber", type: "equip", name: "電磁吸収材", price: 50, auto_trigger: "on_break_elec", desc: "電磁ブレイク時、電磁耐性のみ全快して壊れる。" },
    weakness_ins: { id: "weakness_ins", type: "equip", name: "弱点保険(耐性)", price: 180, auto_trigger: "on_weak", desc: "弱点攻撃を受けた時、全耐性を全快して壊れる。" },
    bitter_berry: { id: "bitter_berry", type: "equip", name: "ラムの実", price: 60, auto_trigger: "on_status", desc: "状態異常になった瞬間、それを治して壊れる。" }
};


// ==========================================
// ▼ アイテムIDのプレフィックスから、デフォルトのAAパスを自動設定する
// ==========================================
const defaultAAMap = {
    "sw_": "item.original.basic.剣",
    "ax_": "item.original.basic.斧",
    "df_": "item.original.basic.盾",
    "sp_": "item.original.basic.銃",
    "bomb_": "item.original.basic.爆弾",
    "battery_": "item.original.basic.電池",
    "heal_": "item.original.basic.回復",
    
    // 薬・丸薬系
    "coolant_": "item.original.basic.薬",
    "sniper_": "item.original.basic.薬",
    "surehit_": "item.original.basic.薬",
    "buff_": "item.original.basic.薬",
    "bitter_": "item.original.basic.薬",
    
    // お守り・デコイ系
    "decoy_": "item.original.basic.人形",
    "insulate_": "item.original.basic.人形",
    "focus_": "item.original.basic.人形",
    
    // その他
    "smoke_": "item.original.basic.煙",
    "counter_": "item.original.basic.爆弾",
    "oil_": "item.original.basic.回復",
    "emergency_": "item.original.basic.爆弾",
    "shock_": "item.original.basic.盾",
    "heat_": "item.original.basic.盾",
    "elec_": "item.original.basic.盾",
    "weakness_": "item.original.basic.盾",
};

// ITEMSオブジェクトを走査して、aaプロパティがなければ自動で割り当てる

Object.keys(ITEMS).forEach(key => {
    if (!ITEMS[key].aa) {
        let assigned = false;
        // マップをループして前方一致で探す
        for (const prefix in defaultAAMap) {
            if (key.startsWith(prefix)) {
                ITEMS[key].aa = defaultAAMap[prefix];
                assigned = true;
                break;
            }
        }
        // マップに合致するプレフィックスが無かった場合は汎用の箱アイコンにする
        if (!assigned) {
            ITEMS[key].aa = "item.original.basic.宝箱";
        }
    }
});