import { segment } from "icqq";
import plugin from "../../lib/plugins/plugin.js";
import fetch from 'node-fetch';

export class example extends plugin {
    constructor() {
        super({
            /** 功能名称 */
            name: "测试",
            /** 功能描述 */
            dsc: "简单开发示例",
            /** https://oicqjs.github.io/oicq/#events */
            event: "message",
            /** 优先级，数字越小等级越高 */
            priority: 0,
            rule: [
                {
                    /** 命令正则匹配 */
                    reg: "^#测试",
                    /** 执行方法 */
                    fnc: "test",
                },
                {
                    /** 命令正则匹配 */
                    reg: "^#功能测试2",
                    /** 执行方法 */
                    fnc: "test2",
                },
            ],
        });
    }

    async test(e) {
        //logger.info(e.serialize())
        e.reply(e.img)
    }
    async test2(e){
        e.reply({
            "type": "rps"
          })
    }
}