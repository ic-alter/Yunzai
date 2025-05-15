import fetch from "node-fetch";
import common from "../../lib/common/common.js";

const REGEX = /^(#|\/)?表情包搜索(.*)$/
export class example extends plugin {
    constructor() {
        super({
            name: '表情包搜索',
            dsc: 'example',
            event: 'message',
            priority: 1,
            rule: [
                {
                    reg: REGEX,
                    fnc: 'Searching'
                }
            ]
        });
    }

    async Searching(e) {
        const MATCH = e.msg.match(REGEX)
        const keyword = MATCH[2]
        const FETCH_DATA = await fetch(`https://oiapi.net/API/EmoticonPack/?keyword=${keyword}`);
        const DATA_JSON = await FETCH_DATA.json();
        const limit = DATA_JSON['data'].length
        const msgs = []
        for (let i = 0; i < limit; i++) { msgs.push(segment.image(DATA_JSON['data'][i].url)) }
        return e.reply(await common.makeForwardMsg(e, msgs, keyword))
    }
}
