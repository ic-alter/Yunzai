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
                {
                    /** 命令正则匹配 */
                    reg: "^#groupContext测试",
                    /** 执行方法 */
                    fnc: "groupContextTest",
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
    async groupContextTest(e){
        this.keyWord = "groupContext测试"
        this.e.keyWord = this.keyWord
        this.setContext("groupTestContext",true)
    }
    async groupTestContext(e){
        const context = this.getContext("groupTestContext",true)
        if (this.e.msg?.includes("#展示上下文测试")){
            e.reply(`上下文内容：${context.keyWord}`)
            return
        }
        if (this.e.msg?.includes("#结束上下文测试")){
            this.finish("groupTestContext",true)
            e.reply(`已结束上下文测试`)
            return
        }
        e.reply(`这是群上下文测试，发送 #展示上下文测试 可查看上下文内容，发送 #结束上下文测试 可结束上下文`)

    }
}