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
                    /** 命令正则匹配 */
                    reg: "^#?看看(腿|脚|玉足|玉足|大腿|美腿)$",
                    /** 执行方法 */
                    fnc: "kkleg",
                },
            ],
        });
    }

    async kkleg(e) {
        const response = await fetch('https://api.lolimi.cn/API/meizi/api.php');
        const data = await response.json();
        e.reply(segment.image(data.text))
    }
}
