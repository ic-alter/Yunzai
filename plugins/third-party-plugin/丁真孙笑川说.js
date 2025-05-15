import fetch from "node-fetch";
import { segment } from "icqq";

const REGEX = /^(#|\/)?(陈泽|丁真|孙笑川)说(.*)$/
export class dzsxcshuo extends plugin {
    constructor() {
        super({
            name: '[陈泽][丁真][孙笑川]语音合成',
            dsc: 'example',
            event: 'message',
            priority: 1,
            rule: [{
                reg: REGEX,
                fnc: 'SPEECH_SYNTHESIS'
            }]
        })
    }

    async SPEECH_SYNTHESIS(e) {
        const MATCH = e.msg.match(REGEX)
        const CONTENT = MATCH[3]
        if (!CONTENT) return e.reply('输入内容为空')
        let R = MATCH[2]
        if (R === '陈泽') R = 'chenze'
        if (R === '丁真') R = 'dingzhen'
        if (R === '孙笑川') R = 'sunxiaochuan'
        e.reply("生成语音中")
        const URL_DATA = await (await fetch(`http://ovoa.cc/api/${R}.php?message=${CONTENT}&type=json`)).json()

        e.reply(`生成成功！耗时：${URL_DATA['Time-consuming'].toFixed(2)}秒`)
        return e.reply(segment.record(URL_DATA['audio-url']));
    }
}