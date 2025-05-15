import { segment } from "icqq";
import plugin from "../../lib/plugins/plugin.js";
import fetch from 'node-fetch';

const groupimg='https://p.qlogo.cn/gh/';

export class example extends plugin {
    constructor() {
        super({
            /** 功能名称 */
            name: "群头像",
            /** 功能描述 */
            dsc: "获取群头像",
            /** https://oicqjs.github.io/oicq/#events */
            event: "message",
            /** 优先级，数字越小等级越高 */
            priority: 0,
            rule: [
                {
                    /** 命令正则匹配 */
                    reg: "^#?群头像(.*)",
                    /** 执行方法 */
                    fnc: "quntouxiang",
                },
            ],
        });
    }

    async quntouxiang(e) {
		logger.info('[群头像]', e.msg);
		let qun;
		let qunreg = /[1-9][0-9]{4,12}/;
		let qunret = qunreg.exec(e.toString());
		if (qunret&&!e.at){qun=qunret}
		else{qun=this.e.group_id}
		let url = groupimg + `${qun}/${qun}/640/`;
        logger.info(url)
		e.reply(segment.image(url));
    }
}