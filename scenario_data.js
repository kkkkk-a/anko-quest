// ==========================================
// シナリオデータ：あんこクエスト 〜王道キャラチュートリアル〜
// ==========================================

const SCENARIO = {
    "start": [
        { type: "system_set", enableLevelUp: false, enableResistance: false, enableAttribute: false, enablePartyBattle: false, enableAnalyze: false, skipHitDice: false, enableItemUse: true, enableEquipChange: false, enableEscape: true, enableScout: false, enableTimeSystem: true, enablePermaDeath: false, maxLevel: 99, maxItemCount: 99, maxSkills: 4 },
        { type: "msg", speaker: "やらない夫", aa: "character.original.yaranaio.通常", text: "おい、やる夫。いつまで寝ている。朝だぞ、起きろ。" },
        { type: "msg", speaker: "やる夫", aa: "character.original.yaruo.ダメージ", text: "むにゃむにゃ……あと5分だけだお……。" },
        { type: "msg", speaker: "やらない夫", aa: "character.original.yaranaio.攻撃", text: "今日からお前には、この村で『スローライフ＆冒険者』の基礎を学んでもらう！\nまずは日課の【釣り】に行って、今日の昼飯を確保してこい！" },
        { type: "jump", next: "tut_fishing_play" }
    ],

    "tut_fishing_play": [
        { type: "msg", speaker: "やらない子", aa: "character.original.yaranaiko.笑顔", text: "やる夫くん、おはよう！ 釣りのやり方は分かる？ タイミングよくボタンを押すだけよ。" },
        { type: "msg", speaker: "やる夫", aa: "character.original.yaruo.驚き", text: "やらない子ちゃん！ 俄然やる気が出てきたお、川へ行くお！" },
        
        { type: "minigame", gameType: "gauge", mgTitle: "🎣 釣り", betType: "hp", betAmount: 0, playLimit: 1, targetId: "yaruo", nextScene: "tut_craft", failScene: "tut_fishing_fail", requireSuccess: true, difficulty: 2, rewards: "heal_1" },
        
        { type: "msg", speaker: "やらない夫", aa: "character.original.yaranaio.笑顔", text: "よし、見事に『薬草』を釣り上げたな。\n画面右上の【カレンダー】を見てみろ。朝から【昼】に時間が進んでいるはずだ。" },
        { type: "pass_time", amount: 1, msg: "（釣りを終えると、お昼になっていた…）" },
        { type: "jump", next: "tut_craft" }
    ],

    "tut_fishing_fail": [
        { type: "msg", speaker: "やらない夫", aa: "character.original.yaranaio.攻撃", text: "一回も釣れないなんて、お前やる気あるのか？ やり直しだ！" },
        { type: "jump", next: "tut_fishing_play" } 
    ],

    "tut_craft": [
        { type: "msg", speaker: "やらない子", aa: "character.original.yaranaiko.通常", text: "手に入れた素材は、【アトリエ】でアイテムに加工できるわ。\nさっき釣った薬草で『キズぐすり』を作ってみて！" },

        { type: "craft", title: "🧪 やる夫のアトリエ", category: "", targetItem: "heal_2", targetCount: 1, trueNext: "tut_craft_success", falseNext: "tut_craft_fail" }
    ],

    "tut_craft_fail": [
        { type: "msg", speaker: "やらない子", aa: "character.original.yaranaiko.ピンチ", text: "やる夫くん、キズぐすりを作ってないわよ？ 材料の『薬草』を加工して作ってみて！" },
        { type: "jump", next: "tut_craft" }
    ],

    "tut_craft_success": [
        { type: "msg", speaker: "やる夫", aa: "character.original.yaruo.笑顔", text: "できたお！ 自分で作ったアイテムは愛着が湧くお！" },
        { type: "msg", speaker: "やらない子", aa: "character.original.yaranaiko.笑顔", text: "ふふっ、すごいじゃない。やる夫くんの【好感度】を少し上げてあげる！" },
        { type: "flag_set", targetId: "yaruo", flagName: "affection", operator: "+=", flagValue: 10 },
        { type: "msg", speaker: "システム", aa: "", text: "やる夫 の 好感度(affection) が 10 上がりました。" },
        { type: "msg", speaker: "やらない夫", aa: "character.original.yaranaio.通常", text: "やぁ、二人とも。そろそろバトルの時間だ。" },
        { type: "pass_time", amount: 1, msg: "（準備をしているうちに、夕方になった…）" },
        { type: "jump", next: "tut_battle_basic" }
    ],

    "tut_battle_basic": [
        { type: "system_set", enableLevelUp: true },
        { type: "msg", speaker: "やらない夫", aa: "character.original.yaranaio.通常", text: "よし、ここからは命懸けの【あんこ式バトル】だ。\nお互いに【戦闘ダイス】を振り、出目が大きい方が攻撃権を得る。最大値は『技術＋経験』だ。" },
        { type: "give", target: "surehit_1", amount: 2 },
        { type: "battle", enemies: ["スライム"], initiative: "stats", mapData: "", win: "tut_resist", lose: "tut_lose_basic", draw: "", escape: "tut_lose_basic", scout: "" }
    ],

    "tut_lose_basic": [
        { type: "msg", speaker: "やらない夫", aa: "character.original.yaranaio.ダメージ", text: "おいおい、スライム相手に負ける奴があるかよ……。ほら、回復してやるからやり直せ。" },
        
        { type: "jump", next: "tut_battle_basic" } 
    ],

    "tut_resist":[
        { type: "system_set", enableResistance: true, enableAttribute: true, enableAnalyze: true },
        { type: "pass_time", amount: 1, msg: "（日が暮れて、ついに夜になった…）" },
        { type: "msg", speaker: "やらない夫", aa: "character.original.yaranaio.通常", text: "ここからは【3大耐性】と【ブレイク】システムを解禁する。" },
        { type: "msg", speaker: "やらない子", aa: "character.original.yaranaiko.通常", text: "ゲージがゼロになると【ブレイク】状態になって、致命的なペナルティを受けるの！" },
        { type: "msg", speaker: "やらない夫", aa: "character.original.yaranaio.通常", text: "次は装甲の硬い『ゴブリン』だ。だが『熱量耐性』が低い。\n熱量ブレイクさせて防御をゼロにするんだ！" },
        { type: "battle", enemies: ["ゴブリン"], initiative: "stats", mapData: "", win: "tut_attr", lose: "tut_lose_resist", draw: "", escape: "tut_lose_resist", scout: "" }
    ],

    "tut_lose_resist": [
        { type: "msg", speaker: "やらない夫", aa: "character.original.yaranaio.ダメージ", text: "熱量でブレイクしろと言っただろ……。やり直しだ。" },
        
        { type: "jump", next: "tut_resist" } 
    ],

    "tut_attr":[
        { type: "msg", speaker: "ドクオ", aa: "character.original.dokuo.通常", text: "フヒヒ……俺に触れると『かんせん』で状態異常がうつるぞ……！" },
        { type: "battle", enemies: ["ドクオ"], initiative: "stats", mapData: "", win: "tut_party", lose: "tut_lose_attr", draw: "", escape: "tut_lose_attr", scout: "" }
    ],

    "tut_lose_attr": [
        { type: "msg", speaker: "やらない夫", aa: "character.original.yaranaio.ダメージ", text: "状態異常を甘く見るな……。回復してやるからもう一度だ。" },
        
        { type: "jump", next: "tut_attr" } 
    ],

    "tut_party":[
        { type: "system_set", enablePartyBattle: true, enableScout: true },
        { type: "msg", speaker: "やらない子", aa: "character.original.yaranaiko.ピンチ", text: "悪魔やる夫と、できない夫……！\nやる夫くん、私たちも一緒に戦うわ！【パーティバトル】よ！" },
        { type: "join_party", targetId: "yaranaio", msg: "やらない夫 が なかまに くわわった！" },
        { type: "join_party", targetId: "yaranaiko", msg: "やらない子 が なかまに くわわった！" },
        { type: "battle", enemies:["悪魔やる夫", "できない夫"], initiative: "stats", mapData: "", win: "tut_scout_check", lose: "tut_lose_party", draw: "", escape: "tut_lose_party", scout: "tut_scout_success" }
    ],
    "tut_lose_party": [
        { type: "msg", speaker: "やらない夫", aa: "character.original.yaranaio.ダメージ", text: "数の暴力を甘く見すぎだ……。ほら、やり直せ。" },
        
        { type: "jump", next: "tut_party" } 
    ],

    "tut_scout_check": [
        { type: "msg", speaker: "やらない夫", aa: "character.original.yaranaio.通常", text: "倒してしまったか。まぁ良い。次は盤面バトルの訓練だ。" },
        { type: "jump", next: "tut_tactical" }
    ],

    "tut_scout_success": [
        { type: "msg", speaker: "やる夫", aa: "character.original.yaruo.笑顔", text: "やったお！ 悪魔をモンスターボールに入れたお！" },
        { type: "msg", speaker: "やらない子", aa: "character.original.yaranaiko.笑顔", text: "捕まえた仲間は『預かり所』で編成したり、『配合所』で合成できるわよ！" },
        { type: "jump", next: "tut_tactical" } 
    ],

    "tut_tactical": [
        
        { type: "msg", speaker: "やらない夫", aa: "character.original.yaranaio.通常", text: "最後は多対多の『盤面バトル（タクティカルモード）』だ。" },
        { type: "msg", speaker: "やらない子", aa: "character.original.yaranaiko.通常", text: "移動してターゲットを決めると、1vs1の決闘に入るわ。\n味方に隣接すれば【回復】や【どうぐ】でサポートも可能よ。" },
        { type: "battle", enemies: ["悪魔やる夫", "ゴブリン", "スライム"], initiative: "stats", mapData: ".........\n..#...#..\n.........\n.........\n....#....\n.........\n.........\n..#...#..\n.........", win: "tut_clear", lose: "tut_lose_tactical", draw: "", escape: "tut_lose_tactical", scout: "" }
    ],

    "tut_lose_tactical": [
        { type: "msg", speaker: "やらない夫", aa: "character.original.yaranaio.ダメージ", text: "位置取りが悪い。ほら、回復してやるからやり直せ。" },
        
        { type: "jump", next: "tut_tactical" }
    ],

    "tut_clear": [
        // チュートリアル終了の労い
        { type: "msg", speaker: "やらない夫", aa: "CHARACTER.ORIGINAL.YARANAIO.笑顔", text: "見事だ。お前は生活とバトルの全てを理解したようだな。" },
        { type: "msg", speaker: "やる夫", aa: "CHARACTER.ORIGINAL.YARUO.笑顔", text: "やったおー！ これで俺も立派な冒険者だお！" },
        
        // 本編（第1章）開始に向けたシステムのフル解禁
        { type: "system_set", enableLevelUp: true, enableResistance: true, enableAttribute: true, enablePartyBattle: true, enableAnalyze: true, enableItemUse: true, enableEquipChange: true, enableEscape: true, enableScout: true, enableTimeSystem: true, enablePermaDeath: false, enableSpReset: true, enableMultiEquip: true, enableTactical: true, enableTension: true, maxLevel: 99, maxItemCount: 99, maxSkills: 4, maxPlayerCount: 50, battleMemberCount: 3, maxEquipCount: 2 },
        
        // 冒険の準備金
        { type: "stat_change", targetId: "", mode: "recover", statKey: "money", amount: 500, msg: "冒険の資金として {amount} G を手に入れた！" },
        
        // 次の目的の提示
        { type: "msg", speaker: "やらない夫", aa: "CHARACTER.ORIGINAL.YARANAIO.通常", text: "さあ、まずは【村長】に挨拶へ行け。\n村の北側にいるはずだ。準備ができたら村の南の出口から外の世界へ旅立て！" },
        
        // 村のマップへジャンプ！
        { type: "jump", next: "map_village" }
    ],

    
    "map_village": [
      {
        "type": "bg_set",
        "preset": "linear-gradient(to bottom, #c6f6d5, #9ae6b4)",
        "custom_bg": "auto",
        "textColor": "#1a202c",
        "msgBg": "rgba(0,0,0,0.85)",
        "msgText": "#ffffff",
        "msgSpeaker": "#ecc94b"
      },
      {
        "type": "msg",
        "speaker": "システム",
        "aa": "",
        "text": "【はじまりの村】\n十字キーで移動、Aボタンで調べる／話す。\n・V：村長　・S：道具屋　・O：出口"
      },
      {
        "type": "map",
        "viewType": "top",
        "mapData": "#########\n#V......#\n#.......#\n#...K...#\n#...S...#\n####O####",
        "events": "V:event_mayor, K:shop_village, O:check_exit"
      }
    ],
    "event_mayor": [
      {
        "type": "flag_check",
        "targetId": "",
        "flagName": "quest_start",
        "condition": "==",
        "flagValue": "1",
        "true_next": "event_mayor_done",
        "false_next": "event_mayor_first"
      }
    ],
    "event_mayor_first": [
      {
        "type": "msg",
        "speaker": "村長",
        "aa": "",
        "text": "おお、やる夫よ！立派な冒険者になったそうじゃな。\nさっそくじゃが、村の外にある【東の森】へ向かい、スライムたちを討伐してきてくれんか？"
      },
      {
        "type": "flag_set",
        "targetId": "",
        "flagName": "quest_start",
        "operator": "=",
        "flagValue": "1"
      },
      {
        "type": "msg",
        "speaker": "やる夫",
        "aa": "CHARACTER.ORIGINAL.YARUO.通常",
        "text": "任せるお！サクッと倒してくるお！"
      },
      {
        "type": "jump",
        "next": "map_village"
      }
    ],
    "event_mayor_done": [
      {
        "type": "msg",
        "speaker": "村長",
        "aa": "",
        "text": "村の南にある出口から外へ出られるぞ。\n道中の草むらには魔物が潜んでおるから気をつけるんじゃぞ。"
      },
      {
        "type": "jump",
        "next": "map_village"
      }
    ],
    "shop_village": [
      {
        "type": "shop",
        "items": [
          "heal_1",
          "heal_2",
          "sw_1",
          "df_2"
        ]
      },
      {
        "type": "jump",
        "next": "map_village"
      }
    ],
    "check_exit": [
      {
        "type": "flag_check",
        "targetId": "",
        "flagName": "quest_start",
        "condition": "==",
        "flagValue": "1",
        "true_next": "map_field",
        "false_next": "exit_block"
      }
    ],
    "exit_block": [
      {
        "type": "msg",
        "speaker": "門番",
        "aa": "",
        "text": "ここは村の出口だ。\n村長から許可をもらっていない者は外に出せない決まりになっている。"
      },
      {
        "type": "jump",
        "next": "map_village"
      }
    ],
    "map_field": [
      {
        "type": "bg_set",
        "preset": "auto",
        "custom_bg": "auto",
        "textColor": "auto",
        "msgBg": "rgba(0,0,0,0.85)",
        "msgText": "#ffffff",
        "msgSpeaker": "#ecc94b"
      },
      {
        "type": "msg",
        "speaker": "システム",
        "aa": "",
        "text": "【名もなき平原】\n草むら(g)を歩くと魔物が出現することがあります。\n・O：村へ戻る　・E：東の森へ"
      },
      {
        "type": "map",
        "viewType": "top",
        "mapData": "gggggggggg\ng........E\ng...gggggg\nO........g\ngggg.....g\ngggggggggg",
        "events": "O:map_village, E:event_forest_boss, g:20%battle_wild"
      }
    ],
    "battle_wild":[
      {
        "type": "bg_set",
        "preset": "auto",
        "custom_bg": "auto",
        "textColor": "auto",
        "msgBg": "rgba(0,0,0,0.85)",
        "msgText": "#ffffff",
        "msgSpeaker": "#ecc94b"
      },
      {
        "type": "msg",
        "speaker": "システム",
        "aa": "",
        "text": "魔物が とびだしてきた！"
      },
      {
        "type": "battle",
        "enemies":[ "スライム", "ねらう緒" ],
        "initiative": "stats",
        "mapData": "",
        "win": "map_field",
        "lose": "game_over",
        "draw": "",
        "escape": "map_field",
        "scout": "map_field"
      }
    ],
    "event_forest_boss": [
      {
        "type": "msg",
        "speaker": "やる夫",
        "aa": "CHARACTER.ORIGINAL.YARUO.ピンチ",
        "text": "むむっ……森の奥から強い妖気を感じるお！\nボスの予感がするお！"
      },
      {
        "type": "choice",
        "choices": [
          {
            "text": "覚悟を決めて進む",
            "next": "battle_boss"
          },
          {
            "text": "村へ引き返す",
            "next": "map_field"
          }
        ]
      }
    ],
    "battle_boss":[
      {
        "type": "battle",
        "enemies":[ "ドクオ", "ゴブリン", "ゴブリン" ],
        "initiative": "stats",
        "mapData": ".........\n..#...#..\n.........\n...#.#...\n....#....\n.........\n.........\n..#...#..\n.........",
        "win": "event_clear",
        "lose": "game_over",
        "draw": "",
        "escape": "game_over",
        "scout": "event_clear"
      }
    ],
    "event_clear": [
      {
        "type": "msg",
        "speaker": "やる夫",
        "aa": "CHARACTER.ORIGINAL.YARUO.笑顔",
        "text": "やったお！ 森のボスを討伐したお！\nこれで村も平和になるはずだお！"
      },
      {
        "type": "msg",
        "speaker": "やらない子",
        "aa": "CHARACTER.ORIGINAL.YARANAIKO.笑顔",
        "text": "お疲れ様、やる夫くん。さぁ、村長に報告しに帰りましょう！"
      },
      {
        "type": "msg",
        "speaker": "システム",
        "aa": "",
        "text": "〜 第1章 完 〜\n\nここから先はエディタを使って、自由に物語を広げてみてください！"
      },
      {
        "type": "end"
      }
    ],
    "game_over": [
      {
        "type": "msg",
        "speaker": "システム",
        "aa": "",
        "text": "やる夫たちは全滅してしまった……。"
      },
      {
        "type": "end"
      }
    ]
};
