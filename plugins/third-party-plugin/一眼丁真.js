import plugin from "../../lib/plugins/plugin.js";
import fetch from 'node-fetch';

const baseUrl = 'http://127.0.0.1:12315'

export class example extends plugin {
    constructor() {
        super({
            /** 功能名称 */
            name: "一眼丁真",
            /** 功能描述 */
            dsc: "一眼丁真",
            /** https://oicqjs.github.io/oicq/#events */
            event: "message",
            /** 优先级，数字越小等级越高 */
            priority: 5000,
            rule: [
                {
                    /** 命令正则匹配 */
                    reg: "^#?(一眼丁真)$",
                    /** 执行方法 */
                    fnc: "yydz",
                },
                {
                    /** 命令正则匹配 */
                    reg: "^#?(奶龙)$",
                    /** 执行方法 */
                    fnc: "nailong",
                },
                {
                    /** 命令正则匹配 */
                    reg: "是啥杯$",
                    /** 执行方法 */
                    fnc: "shabei",
                },
                {
                    /** 命令正则匹配 */
                    reg: "^先说结论",
                    /** 执行方法 */
                    fnc: "shabei",
                },
                {
                    /** 命令正则匹配 */
                    reg: "^#?(今日灵感|灵感|睡前故事)$",
                    /** 执行方法 */
                    fnc: "linggan",
                },
                {
                    /** 命令正则匹配 */
                    reg: "^#?(耄耋|猫爹|哈气|哈基米|键帽|略猫|圆头耄耋|老吴)$",
                    /** 执行方法 */
                    fnc: "maodie",
                },
            ],
        });
    }

    async yydz(e) {
        e.reply(segment.image(baseUrl+'/yydz'))
    }
    async nailong(e) {
        e.reply(segment.image(baseUrl+'/nailong'))
    }
    async shabei(e) {
        /*五个等级 极差 较差 一般 较强 极强，分别记01234.两个加起来，0是小杯，1是中杯下，2是中杯上，然后345是大杯上中下，678是超大杯上中下。8是命令所有玩家抽取，67是推荐所有玩家抽取，45是推荐有需要的玩家抽取，23是不推荐玩家抽取，1是不建议任何人以任何理由抽取*/
        let fanyong = get_score()
        let duice = get_score()
        let score = fanyong + duice;
        if((fanyong ==0 || duice ==0)&&score>4){
            score -= 1
        }
        else if((fanyong ==4 || duice ==4)&&score<5){
            score += 1
        }

        const levels = {
            0: '极差',
            1: '较差',
            2: '一般',
            3: '较强',
            4: '极强'
        }

        const cupLevels = {
            0: '小杯',
            1: '中杯下',
            2: '中杯上',
            3: '大杯下',
            4: '大杯中',
            5: '大杯上',
            6: '超大杯下',
            7: '超大杯中',
            8: '超大杯上'
        };

        const recommendations = {
            8: '命令所有玩家抽取',
            7: '推荐所有玩家抽取',
            6: '推荐所有玩家抽取',
            5: '推荐有需要的玩家抽取',
            4: '推荐有需要的玩家抽取',
            3: '不推荐玩家抽取',
            2: '不推荐玩家抽取',
            1: '仅推荐有特殊需求的玩家抽取',
            0: '不建议任何人以任何理由抽取'
        };
        const fanyong_msg = levels[fanyong] ?? '极差';
        const duice_msg = levels[duice] ?? '极差';
        const cup = cupLevels[score] ?? '小杯';
        const recommend = recommendations[score] ?? '不建议任何人以任何理由抽取';
        let msg = `先说结论，泛用性${fanyong_msg}，对策性${duice_msg}，总的来说属于${cup}，${recommend}`
        e.reply([msg, segment.image(baseUrl+`/newshabei?score=${score}`)],1)
    }
    async linggan(e) {
        e.reply(segment.image(baseUrl+'/linggan'))
    }
    async maodie(e) {
        e.reply(segment.image(baseUrl+'/maodie'))
    }
}

function get_score(){
    const i = Math.floor(Math.random() * 7)
    if(i>=6){
        return 4
    } else if (i>=5){
        return 3
    } else{
        return i
    }
}