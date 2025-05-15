/**
 * 来自https://oiapi.net/?action=doc&id=32的api
 */
import { segment } from "icqq";
import plugin from "../../lib/plugins/plugin.js";
import fetch from 'node-fetch';

export class example extends plugin {
    constructor() {
        super({
            /** 功能名称 */
            name: "名言警句",
            /** 功能描述 */
            dsc: "简单开发示例",
            /** https://oicqjs.github.io/oicq/#events */
            event: "message",
            /** 优先级，数字越小等级越高 */
            priority: 5000,
            rule: [
                {
                    /** 命令正则匹配 */
                    reg: "#?名言警句",
                    /** 执行方法 */
                    fnc: "名言警句",
                },
            ],
        });
    }

    async 名言警句(e) {
        fetch('https://oiapi.net/API/Saying', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
        })
            .then(res => {
                if (res.ok) {
                    return res.json()
                }
            })
            .then(data => {
                e.reply([segment.image(data.data.Image), data.data.content, "\n\t\t——", data.data.from])
                return true;
            })
    }
}