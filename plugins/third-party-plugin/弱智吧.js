import plugin from "../../lib/plugins/plugin.js";
import fetch from 'node-fetch';

export class example extends plugin {
    constructor() {
        super({
            /** 功能名称 */
            name: "弱智吧语录",
            /** 功能描述 */
            dsc: "简单开发示例",
            /** https://oicqjs.github.io/oicq/#events */
            event: "message",
            /** 优先级，数字越小等级越高 */
            priority: 5000,
            rule: [
                {
                    /** 命令正则匹配 */
                    reg: "^#?(随机)?(弱智|若智|睿智)(吧)?",
                    /** 执行方法 */
                    fnc: "ruozhi",
                },
            ],
        });
    }

    async ruozhi(e) {
        fetch('http://api.yujn.cn/api/tieba.php?type=json&msg=弱智', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        })
            .then(res => {
                if (res.ok) {
                    return res.json()
                }
            })
            .then(data => {
                let replyMsg = data.title + data.text;
                if(replyMsg.length > 0){
                    e.reply('[弱智吧语录]'+replyMsg+"\n["+data.url+" ]")
                    return true;
                }
            })
    }
}