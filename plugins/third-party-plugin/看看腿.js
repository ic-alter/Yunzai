import plugin from "../../lib/plugins/plugin.js";
import fetch from 'node-fetch';

const baseUrl = 'https://api.lolimi.cn/API/meizi/api.php'

export class example extends plugin {
    constructor() {
        super({
            /** 功能名称 */
            name: "看看腿",
            /** 功能描述 */
            dsc: "看看腿",
            /** https://oicqjs.github.io/oicq/#events */
            event: "message",
            /** 优先级，数字越小等级越高 */
            priority: 5000,
            rule: [
                {
                    reg: "^#?看看(腿|大腿|美腿)$",
                    fnc: "kkleg",
                },
            ],
        });
    }

    async kkleg(e) {
        await kkapi(e, "https://api.lolimi.cn/API/meizi/api.php", 3)
        return true
    }
}

async function kkapi(e, url, num){
    let fakeMsgArr = []
        for (let i=0; i<num; i++){
            const response = await fetch(url);
            const data = await response.json();
            fakeMsgArr.push({
                user_id: e.member.user_id,
                nickname: e.member.nickname,
                message: segment.image(data.text)
              })
        }
        let makeForwardMsg = e.group.makeForwardMsg(fakeMsgArr)
        await e.reply(makeForwardMsg)
        return true
}
