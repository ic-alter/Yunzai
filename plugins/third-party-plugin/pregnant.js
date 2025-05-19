import plugin from '../../lib/plugins/plugin.js'
import fs from 'fs'
import puppeteer from '../../lib/puppeteer/puppeteer.js'
import _ from 'lodash'

import { segment } from 'icqq'
import { release } from 'os'
const API_PREFIX = "http://localhost:12315/pre";

export class example extends plugin {
    constructor() {
        super({
            /** 功能名称 */
            name: "[pregant-生孩子]",
            /** 功能描述 */
            dsc: "生孩子的逻辑",
            /** https://oicqjs.github.io/oicq/#events */
            event: "message",
            /** 优先级，数字越小等级越高 */
            priority: 0,
            rule: [
                {
                    /** 命令正则匹配 */
                    reg: "^#?(撅|狠狠地撅|小撅)",
                    /** 执行方法 */
                    fnc: "jue",
                },
                {
                    /** 命令正则匹配 这个的概率更高*/
                    reg: "^#?(射|🐍|飞机杯)",
                    /** 执行方法 */
                    fnc: "she",
                },
                {
                    /** 命令正则匹配 */
                    reg: "^#?(孩子列表)",
                    /** 执行方法 */
                    fnc: "hukou",
                },
                {
                    reg: "^#?改名",
                    fnc: "gaiming"
                },
                {
                    reg: "^#?(遗弃孩子|遗弃|丢弃|丢弃孩子|弃养)",
                    fnc: "release"
                },
                {
                    reg: "^#?(剃须|收养|领养|捡孩子|收养孩子|领养孩子)$",
                    fnc: "adopt"
                },
            ],
        });
    }

    async jue(e) {
        //e.reply(111)
        let rateadd = 2;
        let ats = e.message.filter(m => m.type === 'at')
        let fid,fname,mid,mname
        //如果at名单为0直接return false继续走。如果为1和2，分别确定父母
        if (ats.length === 0){
            return false
        } else if (ats.length === 1){
            fid = e.user_id
            fname = this.e.sender.nickname
            mid = ats[0].qq
            mname = ats[0].text
        } else if(ats.length >= 2){
            fid = ats[0].qq
            fname = ats[0].text
            mid = ats[1].qq
            mname = ats[1].text
        }
        if(mid === Bot.uin){
            //机器人不会生孩子
            return false
        }
        console.log(fname, fid, mname, mid)
        try {
            let success = await tryBreed(fid, fname, mid, mname, rateadd);
        if(success){
            //Bot.sendPrivateMsg(mid, "恭喜你在被撅之后成功怀孕了!使用\'#孩子列表\'查看孩子信息,使用\'#改名{编号}{新名字}\'修改孩子名字，例如#改名123张三")
            e.reply([{
                "type": "at",
                "data": {
                  "qq": mid,
                }
              },{
                "type": "text",
                "data": {
                  "text": " 恭喜你怀孕了!使用\'#孩子列表\'查看孩子信息"
                }
              }])
        }
        return false
          } catch (error) {
            // 错误处理逻辑
            console.error('发生错误:', error);
            return false
          }
    }

    async she(e) { 
        let rateadd = 3;
        let ats = e.message.filter(m => m.type === 'at')
        let fid,fname,mid,mname
        //如果at名单为0直接return false继续走。如果为1确定父母
        if (ats.length === 0){
            return false
        } else if (ats.length >= 1){
            fid = e.user_id
            fname = this.e.sender.nickname
            mid = ats[0].qq
            mname = ats[0].text
        } 
        if(mid === Bot.uin){
            //机器人不会生孩子
            return false
        }
        let success = await tryBreed(fid, fname, mid, mname, rateadd);
        if(success){
            //Bot.sendPrivateMsg(mid, "恭喜你在被撅之后成功怀孕了!使用\'#孩子列表\'查看孩子信息，使用\'#改名{编号}{新名字}\'修改孩子名字，例如#改名123张三")
            e.reply([{
                "type": "at",
                "data": {
                  "qq": mid,
                }
              },{
                "type": "text",
                "data": {
                  "text": " 恭喜你怀孕了!使用\'#孩子列表\'查看孩子信息"
                }
              }])
        }
        return false
    }
    async hukou(e){
        let childrenlist = await fetchChildren(e.sender.user_id)
        let _path = process.cwd() + '/data/pregnant'
        let data = {
            tplFile: `${_path}/hukou.html`,
            childrenlist:childrenlist["children"]
        }
    
        let img = await puppeteer.screenshot('pregnant', data)
        if (img) await this.e.reply(_.concat(img))
        return true //返回true 阻挡消息不再往下
    }
    async gaiming(e){
        const pattern = /^#?改名(\d+)\s*([\u4e00-\u9fa5a-zA-Z]+)$/;
        const match = e.msg.match(pattern);
        if (match) {
            const cid = parseInt(match[1]);
            const name = match[2];
            let res = await(renameChild(cid, name, e.sender.user_id))
            if(res){
                e.reply("改名成功！")
                this.hukou(e)
                return true
            } else{
                e.reply("改名失败，请确认孩子编号是否存在")
                return true
            }
        } else {
            console.log("格式不正确");
            return true
            }

    }
    async release(e){
        const pattern = /^#?(遗弃孩子|遗弃|丢弃|丢弃孩子|弃养)\s*(\d+)$/;
        const match = e.msg.match(pattern);
        if (match) {
            const cid = parseInt(match[2]);
            let res = await(release_request(cid, e.sender.user_id))
            if(res){
                e.reply("已遗弃。。。")
                this.hukou(e)
                return true
            } else{
                e.reply("遗弃失败，请确认孩子编号是否正确")
            }
        } else return true
    }
    async adopt(e){
        let success = await adopt_request(e.sender.user_id)
        if(success){
            e.reply("捡到一个被遗弃的孩子")
            this.hukou(e)
            return true
        } else {
            e.reply("暂时没有被遗弃的孩子，可以等待别人遗弃")
            return true
        }
    }
}

async function tryBreed(fid, fname, mid, mname, rateAdd) {
    const url = `${API_PREFIX}/try_pregnant`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        fid,
        fname,
        mid,
        mname,
        rate_add: rateAdd
      })
    });
  
    const result = await response.json();
    return result.success;
  }


  async function fetchChildren(ownerid) {
    const response = await fetch(`${API_PREFIX}/childrenlist?ownerid=${ownerid}`);
    const data = await response.json();
    return data.children;
  }

  async function renameChild(cid, name, ownerid) {
    try {
      const response = await fetch(`${API_PREFIX}/rename_child`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ cid, name ,ownerid})
      });
  
      const data = await response.json();
      return data.success === true;
    } catch (error) {
      console.error('请求失败:', error);
      return false;
    }
  }
  async function release_request(cid, ownerid){
    try {
        const response = await fetch(`${API_PREFIX}/release_child`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ cid ,ownerid})
        });
    
        const data = await response.json();
        return data.success === true;
      } catch (error) {
        console.error('请求失败:', error);
        return false;
      }
  }

  async function adopt_request(id){
    const response = await fetch(`${API_PREFIX}/adopt?id=${id}`);
    const data = await response.json();
    return data.success
  }
