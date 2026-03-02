/** 花色 */
export enum TileSuit {
    Wan = 'wan',       // 万
    Tiao = 'tiao',     // 条
    Bing = 'bing',     // 饼
    Wind = 'wind',     // 风
    Dragon = 'dragon', // 箭
}

/** 点数 / 牌面 */
export enum TileRank {
    One = 1, Two = 2, Three = 3, Four = 4, Five = 5,
    Six = 6, Seven = 7, Eight = 8, Nine = 9,
    // 风牌
    East = 10, South = 11, West = 12, North = 13,
    // 箭牌
    Zhong = 14, Fa = 15, Bai = 16,
}

/** 面子类型 */
export enum MeldType {
    Shunzi = 'shunzi',   // 顺子 (三张连续同花色)
    Kezi = 'kezi',       // 刻子 (三张相同)
    Gangzi = 'gangzi',   // 杠子 (四张相同)
    Pair = 'pair',       // 雀头 (对子)
}

/** 杠牌类型 */
export enum KongType {
    /** 暗杠: 4张纯天然相同牌 (无万能牌/非符咒生成), 倍率 ×3 */
    DarkKong = 'darkKong',
    /** 明杠: 包含万能牌或符咒复制牌, 倍率 ×2 */
    LightKong = 'lightKong',
}

/** 提交堆槽位区域 */
export enum SlotArea {
    /** 结算槽: 放顺子/刻子/雀头 */
    Settlement = 'settlement',
    /** 杠槽: 专放杠牌 */
    Kong = 'kong',
}

/** 胡牌牌型 (番种) */
export enum HandPattern {
    PingHu = 'pinghu',                     // 平胡 (全顺子+雀头), ×2
    DuanYaoJiu = 'duanyaojiu',             // 断幺九 (无1/9/字), ×3
    HunYiSe = 'hunyise',                   // 混一色 (单花色+字), ×4
    DuiDuiHu = 'duiduihu',                 // 对对和 (全刻子), ×4
    QiDuiZi = 'qiduizi',                   // 七对子, ×5
    QuanDaiYaoJiu = 'quandaiyaojiu',       // 全带幺九, ×5
    QingYiSe = 'qingyise',                 // 清一色 (纯单花色), ×6
    ZiYiSe = 'ziyise',                     // 字一色, ×8
    GuoShiWuShuang = 'guoshiwushuang',     // 国士无双, ×10
    Partial = 'partial',                   // 散牌面子/雀头 (增量提交用), ×1
}

/** 游戏阶段 */
export enum GamePhase {
    /** 初始化 / 抽牌阶段 */
    Draw = 'draw',
    /** 玩家选择操作 (提交/换牌) */
    Select = 'select',
    /** 提交组到提交堆 */
    Submit = 'submit',
    /** 换牌阶段 */
    Discard = 'discard',
    /** 算分结算 */
    Score = 'score',
    /** 商店阶段 */
    Shop = 'shop',
    /** 地图/选关 */
    Map = 'map',
    /** 事件 */
    Event = 'event',
}

/** 牌属性 (符咒效果) */
export enum TileAttribute {
    Normal = 'normal',
    Gold = 'gold',     // 点金
    Glass = 'glass',   // 琉璃
    Flash = 'flash',   // 闪光 (拾荒鸟效果)
}

/** 雀鸟效果类型 */
export enum SparrowEffectType {
    AddChips = 'addChips',
    AddMult = 'addMult',
    MultMult = 'multMult',
    Economy = 'economy',
}

/** 符咒分类 (对标 Balatro: Tarot / Planet / Spectral / Voucher) */
export enum TalismanCategory {
    /** 符箓 (Tarot) — 牌面操作 */
    Talisman = 'talisman',
    /** 星宿 (Planet) — 番种强化 */
    Star = 'star',
    /** 灵符 (Spectral) — 高风险操作 */
    Spirit = 'spirit',
    /** 道印 (Voucher) — 永久规则改变 */
    Seal = 'seal',
}

/** 符咒效果类型 */
export enum TalismanEffectType {
    ChangeAttribute = 'changeAttribute',
    TempMult = 'tempMult',
    Draw = 'draw',
    /** 回旋符: 收回上次换出的牌并重新换 */
    UndoDiscard = 'undoDiscard',
    /** 贪婪符: 换牌时从弃牌堆选牌 */
    PickFromDiscard = 'pickFromDiscard',
    /** 镜像符: 复制一张手牌 */
    CopyTile = 'copyTile',
    /** 净化符: 从牌库永久移除指定牌 */
    RemoveFromDeck = 'removeFromDeck',
    /** 延寿符: +1 换牌次数 */
    AddDiscard = 'addDiscard',
}

// ─── 对局外流程枚举 ─────────────────────────────────────────

/** 对局外阶段 */
export enum MetaPhase {
    MainMenu = 'mainMenu',
    Shop = 'generalStore',
    Inventory = 'inventory',
    PackOpening = 'packOpening',
    MapSelect = 'mapSelect',
    GameOver = 'gameOver',
    Victory = 'victory',
}

/** 稀有度 */
export enum Rarity {
    Common = 1,
    Uncommon = 2,
    Rare = 3,
    Legendary = 4,
}

/** 永久天赋类型 */
export enum PermanentTalentType {
    /** 初始资金提升 */
    InitialMoney = 'initialMoney',
    /** 弃牌上限提升 */
    MaxDiscard = 'maxDiscard',
    /** 雀鸟栏上限提升 */
    MaxSparrowSlots = 'maxSparrowSlots',
    /** 商店折扣 */
    ShopDiscount = 'shopDiscount',
}

/** 卡包类型 */
export enum PackType {
    SparrowPack = 'sparrowPack',
    TalismanPack = 'talismanPack',
}

/** 初始牌组模式 (Deck Mode) */
export enum DeckMode {
    /** 标准136张牌组 */
    Standard = 'standard',
    /** 纯条子倾向牌组 (以条子为主，极易做清一色) */
    Bamboo = 'bamboo',
    /** 断幺九纯净版 (无1,9，无字牌) */
    Simples = 'simples',
}

/** 语言 */
export enum Language {
    ZH = 'zh',
    EN = 'en',
}
