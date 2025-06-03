/*
成分姬插件 - YunzaiBot特供版
核心代码思路来自：NoneBot2 成分姬插件 - https://github.com/noneplugin/nonebot-plugin-ddcheck
改编者：Yujio_Nako
若有bug可以在GitHub提请issue：
https://github.com/ldcivan/ddcheck_plugin
*/

import plugin from '../../lib/plugins/plugin.js'
import { segment } from "oicq";
import fetch from "node-fetch"
import schedule from 'node-schedule'
import fs from 'fs'
import cfg from '../../lib/config/config.js'
import lodash from 'lodash'
import common from '../../lib/common/common.js'

//在这里填写你的b站cookie↓↓↓↓↓
var cookie = "SESSDATA=XXXXXXXXXXXX;" //理论上SESSDATA即可
//在这里填写你的b站cookie↑↑↑↑↑
//在这里填写你的自动刷新列表设置↓↓↓↓↓
let rule =`0 0 0 * * ?`  //更新的秒，分，时，日，月，星期几；日月/星期几为互斥条件，必须有一组为*
let auto_refresh = 0  //是否自动更新列表，1开0关
let divisor = 100  //切割发送阈值，0则不切割
let masterId = cfg.masterQQ[0]  //管理者QQ账号

//v列表接口地址 https://github.com/dd-center/vtbs.moe/blob/master/api.md =>meta-cdn
var api_cdn = "https://api.vtbs.moe/meta/cdn" 



let record_num = 0
let refresh_num = 0
let record = []
let refresh = []

let refresh_task = schedule.scheduleJob(rule, async (e) => {  //定时更新
    if(auto_refresh==1){
        const res = await fetch(api_cdn, { "method": "GET" })
        const urls = await res.json()
        var local_json = JSON.parse(fs.readFileSync(dirpath + "/" + filename, "utf8"));//读取文件
        for(var i = 0;i<Object.keys(urls).length;i++){
            try {
                var response = await fetch(urls[i]+"/v1/short", { "method": "GET" });
            } catch (e) {
                Bot.pickUser(masterId).sendMsg("发生异常:" + e)
                console.log("发生异常:" + e)
            }
            if(response.status==200){
                await Bot.pickUser(masterId).sendMsg(`使用api：${urls[i]}`)
                break
            }
        }
        let v_list = await response.json()
        
        record_num = 0
        refresh_num = 0
        record = []
        refresh = []
        for(var j = 0;j<Object.keys(v_list).length;j++){
            var data = {
                "uname": v_list[j].uname,
                "roomid":v_list[j].roomid
            }
            if(!local_json.hasOwnProperty(v_list[j].mid)) {//如果json中不存在该用户
                local_json[v_list[j].mid] = data
                console.log(`${v_list[j].mid}已记录`)
                record.push(`${v_list[j].mid}已记录`)
                record_num++
            }else{
                if(local_json[v_list[j].mid].uname != data.uname || local_json[v_list[j].mid].roomid != data.roomid) //存在但有变化
                {   
                    console.log(`${v_list[j].mid}已刷新`)
                    refresh.push(`${v_list[j].mid}已刷新，${JSON.stringify(local_json[v_list[j].mid])}→${JSON.stringify(data)}`)
                    local_json[v_list[j].mid] = data
                    refresh_num++
                }
            }
        }
        await fs.writeFileSync(dirpath + "/" + filename, JSON.stringify(local_json, null, "\t"));//写入文件
        await Bot.pickUser(masterId).sendMsg(`虚拟主播列表更新完毕，共获取${Object.keys(v_list).length}条信息，现存在${Object.keys(local_json).length}条信息！`)
        if(record_num!=0) {
            await Bot.pickUser(masterId).sendMsg(`新增了${record_num}条`)
            if(record_num<=10) {await Bot.pickUser(masterId).sendMsg(`${record}`)}
        }
        if(refresh_num!=0) {
            await Bot.pickUser(masterId).sendMsg(`更新了${refresh_num}条`)
            if(refresh_num<=10) {await Bot.pickUser(masterId).sendMsg(`${refresh}`)}
        }
        await Bot.pickUser(masterId).sendMsg(`成分姬 V列表自动更新已完成`)
    }
})




const attention_url = "https://account.bilibili.com/api/member/getCardByMid?mid=" //B站基本信息接口 含关注表
const medal_url = "https://api.live.bilibili.com/xlive/web-ucenter/user/MedalWall?target_id=" //粉丝牌查询接口
const search_url = `https://api.bilibili.com/x/web-interface/wbi/search/type?search_type=bili_user&keyword=` //昵称转uid
const dirpath = "data/cha_chengfen" //本地V列表文件夹
var filename = `vtuber_list.json` //本地V列表文件名
if (!fs.existsSync(dirpath)) {//如果文件夹不存在
	fs.mkdirSync(dirpath);//创建文件夹
}
if (!fs.existsSync(dirpath + "/" + filename)) {
    fs.writeFileSync(dirpath + "/" + filename, JSON.stringify({
    }))
}

export class example extends plugin {
    constructor() {
        super({
            name: 'DDchecker',
            event: 'message',
            priority: 5000,
            rule: [
                {
                    reg: '^#?查?成分帮助$',
                    fnc: 'chengfen_help'
                },
                {
                  reg: "^#?更新(V|v)列表$",
                  fnc: 'get_v_list'
                },
                {
                  reg: "^#?查成分.*$",
                  fnc: 'cha_chengfen'
                },
                {
                    reg: "^#?(增加|添加)成分.*$",
                    fnc: 'add_list'
                },
                {
                    reg: "^#?删除成分.*$",
                    fnc: 'delete_list'
                }
            ]
        })
    }
    
    async add_list(e) {
        //TODO
        let name = e.msg.replace(/#| |(增加|添加)成分/g, "")
        if(name == "") {
            this.chengfen_help(e)
            return
        }
        let mid = ''
        let response = await this.getBilibiliUp(name)
        if (!response.ok) {
            this.reply("诶嘿，出了点网络问题，等会再试试吧~");
            return;
        }
        const res = await response.json();
        if (res.code !== 0 || !res.data.result || !res.data.result.length) {
            this.reply("没有搜索到该用户，请换个关键词试试吧");
            return;
        }
        let items = res.data.result;
        if (items.length > 1){
            e.reply("搜索到用户过多，默认增加首个用户。")
            mid = items[0]["mid"]
        } else {
            mid = items[0]["mid"]
        }
        var local_json = JSON.parse(fs.readFileSync(dirpath + "/" + filename, "utf8"));//读取文件
        var data = {
            "uname": name
        } 
        if(!local_json.hasOwnProperty(mid)) {//如果json中不存在该用户
            local_json[mid] = data
            console.log(`${mid}已记录`)
            record.push(`${mid}已记录`)
        }else{
            if(local_json[mid].name != data.uname) //存在但有变化
            {   
                console.log(`${mid}已刷新`)
                refresh.push(`${mid}已刷新，${JSON.stringify(local_json[mid])}→${JSON.stringify(data)}`)
                local_json[mid] = data
            }
        }
        await fs.writeFileSync(dirpath + "/" + filename, JSON.stringify(local_json, null, "\t"));//写入文件
        this.reply(`已添加成分。昵称：${name};uid:${mid}`)
        
    }

    async delete_list(e){
        if (!(e.member.is_admin||e.isMaster)){
            this.reply("无权限进行删除")
            return
        }
        let name = e.msg.replace(/#| |删除成分/g, "")
        if(name == "") {
            this.chengfen_help(e)
            return
        }
        var local_json = JSON.parse(fs.readFileSync(dirpath + "/" + filename, "utf8"));//读取文件
        for (const uid in local_json) {
            if (local_json[uid].uname === name) {
                delete local_json[uid]; 
            }
          }
        await fs.writeFileSync(dirpath + "/" + filename, JSON.stringify(local_json, null, "\t"));//写入文件
        this.reply(`已删除成分。昵称：${name}`)
    }

    async cha_chengfen(e) {
        let base_info = []
        let message = []
        let mid = e.msg.replace(/#| |查?成分/g, "")
        if(mid == "") {
            this.chengfen_help(e)
            return
        }
        let name = ''
        if(isNaN(mid)){
            /*var uid_name = await this.name2uid(mid)
            mid = uid_name["mid"]
            name = uid_name["name"]
            if (mid==0) {
                this.reply(`无法由该昵称(${name})转换为uid`)
                return false
            }
            else{
                this.reply(`已使用uid：${mid}，昵称为：${name}`)
            }*/
            let response = await this.getBilibiliUp(mid)
            if (!response.ok) {
                this.reply("诶嘿，出了点网络问题，等会再试试吧~");
                return;
            }
            const res = await response.json();
            if (res.code !== 0 || !res.data.result || !res.data.result.length) {
                this.reply("没有搜索到该用户，请换个关键词试试吧");
                return;
            }
            let items = res.data.result;
            if (items.length > 1){
                // 搜索到的人过多
                const messages = [];
                res.data.result.map((item, index) => {
                    if (index < 3) {
                        messages.push(
                        `${item.uname}\nUID：${item.mid}\n粉丝数：${item.fans}${
                            index < 2 ? "\n" : ""
                        }`
                        );
                    }
                    return item;
                });
                e.reply("搜索到用户过多，默认添加首个用户。\n可通过uid查成分。示例：\'#查成分 26070060\'")
                e.reply(messages.join("\n"));
                mid = items[0]["mid"]
                name = items[0]["name"]
            } else {
                mid = items[0]["mid"]
                name = items[0]["name"]
            }

        }
        const vtb_list = JSON.parse(fs.readFileSync(dirpath + "/" + filename, "utf8"));//读取文件
        const attention_list = await this.get_attention_list(mid)
        if(attention_list.card.attention!=0 && JSON.stringify(attention_list.card.attentions)=="[]"){
            this.reply(`对方隐藏了关注列表,鉴定为偷偷关注原神`)
            return
        }
        const medal_list = await this.get_medal_list(mid)
        await base_info.push(segment.image((attention_list.card.face)))
        await base_info.push(`${JSON.stringify(attention_list.card.name).replaceAll(`\"`, ``)} (uid: ${mid})  Lv${JSON.stringify(attention_list.card.level_info.current_level)}\n粉丝：${attention_list.card.fans}\n关注：${Object.keys(attention_list.card.attentions).length}\n`)
        if(attention_list.card.official_verify.type!=-1)
            await base_info.push(`bilibili认证：${JSON.stringify(attention_list.card.official_verify.desc).replaceAll(`\"`, ``)}`)
        
        var v_num = 0;
        var split_index = 0;
        message[split_index] = [];
        for(var i = 0;i<Object.keys(attention_list.card.attentions).length;i++){
            if(vtb_list.hasOwnProperty(attention_list.card.attentions[i])) {//如果json中存在该用户
                let uid = attention_list.card.attentions[i];
                message[split_index].push(`${JSON.stringify(vtb_list[uid].uname).replaceAll("\"","")} - ${uid}\n`)
                if(medal_list.hasOwnProperty(attention_list.card.attentions[i])){
                    message[split_index].push(`└${JSON.stringify(medal_list[uid].medal_name).replaceAll("\"","")}|${medal_list[uid].level}\n`)
                }
                v_num++;
                if (divisor !== 0) {
                    if (v_num % divisor === 0) {
                        split_index++;
                        message[split_index] = [];
                    }
                }
            }
        }
        var dd_percent_str = `${(v_num/(i)*100).toFixed(2)}% (${v_num}/${i})\n-------\n`;
        for(var i = 0; i < message.length; i++) {
            message[i].unshift(dd_percent_str);
        
            let forwardMsg = await this.makeForwardMsg(`查成分结果(第${i+1}页/共${message.length}页${divisor===0?'':`/每页${divisor}项`})：`, base_info, message[i])
            await this.reply(forwardMsg)
        }
        return
    }

    async getBilibiliUp(keyword) {
        let url = `https://api.bilibili.com/x/web-interface/search/type?keyword=${keyword}&page=1&search_type=bili_user&order=totalrank&pagesize=5`;
        const response = await fetch(url, {
          method: "GET",
          headers: {
            authority: "api.bilibili.com",
            cookie:
              "_uuid=04A91AF9-817E-5568-C260-F738C6992B3E65500infoc; buvid3=89F4F8FC-EC89-F339-53E0-BEB8917E839A65849infoc; buvid4=2D3B9929-A59A-751A-A267-64B84561875568042-022072912-ptQYXgw9NYmp0JTqr/FVmw%3D%3D; PVID=1; CURRENT_FNVAL=4048; nostalgia_conf=-1; i-wanna-go-back=-1; b_ut=7; innersign=0; b_lsid=D95BBB69_182DE35FC2B; fingerprint=8d0ef00128271df9bb681430277b95d0; buvid_fp_plain=undefined; buvid_fp=8d0ef00128271df9bb681430277b95d0",
            "cache-control": "no-cache",
            pragma: "no-cache",
            "sec-ch-ua":
              '"Microsoft Edge";v="105", "Not)A;Brand";v="8", "Chromium";v="105"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"macOS"',
            "sec-fetch-dest": "document",
            "sec-fetch-mode": "navigate",
            "sec-fetch-site": "none",
            "sec-fetch-user": "?1",
            "upgrade-insecure-requests": 1,
            "user-agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.0.0 Safari/537.36 Edg/105.0.1343.50",
          },
          redirect: "follow",
        });
        return response;
      }
    
    
    async get_v_list(e) {
        const res = await fetch(api_cdn, { "method": "GET" })
        const urls = await res.json()
        var local_json = JSON.parse(fs.readFileSync(dirpath + "/" + filename, "utf8"));//读取文件
        for(var i = 0;i<Object.keys(urls).length;i++){
            try {
                var response = await fetch(urls[i]+"/v1/short", { "method": "GET" });
            } catch (e) {
                this.reply("发生异常:" + e)
                console.log("发生异常:" + e)
            }
            if(response.status==200){
                await this.reply(`使用api：${urls[i]}`)
                break
            }
        }
        let v_list = await response.json()
        
        record_num = 0
        refresh_num = 0
        record = []
        refresh = []
        for(var j = 0;j<Object.keys(v_list).length;j++){
            var data = {
                "uname": v_list[j].uname,
                "roomid":v_list[j].roomid
            }
            if(!local_json.hasOwnProperty(v_list[j].mid)) {//如果json中不存在该用户
                local_json[v_list[j].mid] = data
                console.log(`${v_list[j].mid}已记录`)
                record.push(`${v_list[j].mid}已记录`)
                record_num++
            }else{
                if(local_json[v_list[j].mid].uname != data.uname || local_json[v_list[j].mid].roomid != data.roomid) //存在但有变化
                {   
                    console.log(`${v_list[j].mid}已刷新`)
                    refresh.push(`${v_list[j].mid}已刷新，${JSON.stringify(local_json[v_list[j].mid])}→${JSON.stringify(data)}`)
                    local_json[v_list[j].mid] = data
                    refresh_num++
                }
            }
        }
        await fs.writeFileSync(dirpath + "/" + filename, JSON.stringify(local_json, null, "\t"));//写入文件
        await this.reply(`虚拟主播列表更新完毕，共获取${Object.keys(v_list).length}条信息，现存在${Object.keys(local_json).length}条信息！`)
        if(record_num!=0) {await this.reply(`新增了${record_num}条`)
            if(record_num<=5) {await this.reply(`${record}`)}
        }
        if(refresh_num!=0) {await this.reply(`更新了${refresh_num}条`)
            if(refresh_num<=5) {await this.reply(`${refresh}`)}
        }
    }
    
    async get_attention_list(mid) {
        var response = await fetch(attention_url+mid, { "method": "GET" });
        if (response.status>=400&&response.status<500) {
            await this.reply("404，可能是uid不存在")
            return false
        }
        var attention_list = await response.json()
        if(attention_list.code!=0){
            await this.reply(`获取目标关注列表失败，可能是查无此人：${attention_list.message}`)
            return false
        }
        return attention_list
    }
    
    async get_medal_list(mid) {
        var response = await fetch(medal_url+mid, { "headers": {"cookie": cookie},"method": "GET" });
        if (response.status==404) {
            await this.reply("404，可能是uid不存在")
            return false
        }
        var medal_list_raw = await response.json()
        var medal_list = {}
        if(medal_list_raw.code!=0){
            return medal_list
        }
        for(var i = 0;i<Object.keys(medal_list_raw.data.list).length;i++){
            var data = {
                "level":medal_list_raw.data.list[i].medal_info.level,
                "medal_name":medal_list_raw.data.list[i].medal_info.medal_name
            }
            medal_list[medal_list_raw.data.list[i].medal_info.target_id] = data
        }
        return medal_list
    }
    
    async makeForwardMsg (title, base_info, msg) {
    let nickname = Bot.nickname
    if (this.e.isGroup) {
      let info = await Bot.pickMember(this.e.group_id, Bot.uin)
      nickname = info.nickname || info.card
    }
    let userInfo = {
      user_id: Bot.uin,
      nickname
    }

    let forwardMsg = [
      {
        ...userInfo,
        message: title
      },
      {
        ...userInfo,
        message: base_info
      },
      {
        ...userInfo,
        message: msg
      }
    ]

    /** 制作转发内容 */
    if (this.e.isGroup) {
      forwardMsg = await this.e.group.makeForwardMsg(forwardMsg)
    } else {
      forwardMsg = await this.e.friend.makeForwardMsg(forwardMsg)
    }

    /** 处理描述 */
    forwardMsg.data = JSON.stringify(forwardMsg.data)
    forwardMsg.data = forwardMsg.data
      .replace(/\n/g, '')
      .replace(/<title color="#777777" size="26">(.+?)<\/title>/g, '___')
      .replace(/___+/, `<title color="#777777" size="26">${title}</title>`)
    forwardMsg.data = JSON.parse(forwardMsg.data)

    return forwardMsg
  }
  async chengfen_help(e){
      await this.reply("查成分帮助\n1.使用\'#查成分 目标uid或者昵称全称\' 获取目标的成分，包括关注的关键账号\n2.使用\'#增加成分 目标昵称\'，在查成分列表中增加对应账号\n3.使用\'#删除成分 目标昵称\',在查成分列表中删除对应账号（需要权限）")
  }
}