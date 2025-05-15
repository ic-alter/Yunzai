import fs from 'fs'
import path from 'path';
import { fileURLToPath } from 'url';
import dayjs from 'dayjs';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import pkg from 'lodash';
const {get} = pkg;

const width = 800;
const height = 600;
const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height });

/**
 * 作者：千奈千祁(2632139786)
 * Gitee主页：Gitee.com/QianNQQ
 * Github主页：Github.com/QianNQQ
 * 
 * 该插件所有版本发布于 该仓库(https://gitee.com/qiannqq/yunzai-plugin-JS)
 * 本插件及该仓库的所有插件均遵循 GPL3.0 开源协议
 * 
 * 请勿使用本插件进行盈利等商业活动行为
 */
//npm install chart.js canvas chartjs-node-canvas dayjs fs

//发言榜榜单上限人数
let lul = 30

export class example2 extends plugin {
    constructor () {
      super({
        name: '发言次数统计',
        dsc: '发言次数统计',
        event: 'message',
        priority: -500,
        rule: [
          {
            reg: '',
            fnc: 'snots',
            log: false
          }, {
            reg: '^#?发言(榜|统计)(日榜|月榜)?$',
            fnc: '发言次数统计'
          },
          {
            reg: '^#?历史发言(榜|统计)(.*)?$',
            fnc: '历史发言次数统计'
          },
          {
            reg: '^#?昨日发言(榜|统计)$',
            fnc: '昨日发言次数统计'
          },
          {
            reg: '^#?上月发言(榜|统计)$',
            fnc: '上月发言次数统计'
          },
          {
            reg: '^#?(发言次数|发言|发言数据|水群)可视化$',
            fnc: '发言次数可视化'
          },
          {
            reg: '^#?个人(发言次数|发言|发言数据|水群)可视化$',
            fnc: '个人发言次数可视化'
          },
        ]
      })
    }
    async 发言次数统计(e) {
        let user_msg = e.msg.match(/^#?发言(榜|统计)(日榜|月榜)?$/)
        let data
        try {
            if(!user_msg[2] || user_msg[2] == `日榜`) {
                let date = await gettoday()
                data = fs.readFileSync(`./data/${e.group_id}_snots/${date}.json`, `utf-8`)
            } else {
                let month = await getmonth()
                data = fs.readFileSync(`./data/${e.group_id}_snots/${month}.json`, `utf-8`)
            }
            data = JSON.parse(data)
        } catch {
            e.reply(`本群好像还没人说过话呢~`)
            return true
        }
        data.sort((a, b) => b.number - a.number)
        data = data.slice(0, lul)
        let msg = [`本群发言榜如下:\n--------`]
        let paiming = 0
        for (let item of data) {
            paiming++
            msg.push(`\n第${paiming}名：${item.nickname}·${item.number}次`)
        }
        await this.send_msg(e,msg)
        return true
    }
    async 昨日发言次数统计(e){
        let date = await getYesterday()
        let data = fs.readFileSync(`./data/${e.group_id}_snots/${date}.json`, `utf-8`)
        data = JSON.parse(data)
        data.sort((a, b) => b.number - a.number)
        data = data.slice(0, lul)
        let msg = [`本群昨日发言榜如下:\n--------`]
        let paiming = 0
        for (let item of data) {
            paiming++
            msg.push(`\n第${paiming}名：${item.nickname}·${item.number}次`)
        }
        await this.send_msg(e,msg)
        return true
    }
    async 上月发言次数统计(e){
        let month = await getLastMonth()
        let data = fs.readFileSync(`./data/${e.group_id}_snots/${month}.json`, `utf-8`)
        data = JSON.parse(data)
        data.sort((a, b) => b.number - a.number)
        data = data.slice(0, lul)
        let msg = [`本群上月发言榜如下:\n--------`]
        let paiming = 0
        for (let item of data) {
            paiming++
            msg.push(`\n第${paiming}名：${item.nickname}·${item.number}次`)
        }
        await this.send_msg(e,msg)
        return true
    }
    async 历史发言次数统计(e) {
        let user_msg = e.msg.match(/^#?历史发言(榜|统计)(.*)?$/)
        let data
        try {
            if(user_msg[2]) {

                data = fs.readFileSync(`./data/${e.group_id}_snots/${user_msg[2].replace(/\s+/g, '')}.json`, `utf-8`)
            }
            data = JSON.parse(data)
        } catch {
            e.reply("暂无记录或日期格式错误。\n可通过\'#历史发言榜年年年年-月月-日日\'或\'#历史发言榜年年年年-月月\'查询历史发言榜\n例如\'#历史发言榜2024-06-10\'或\'#历史发言榜2024-06\'")
            return true
        }
        data.sort((a, b) => b.number - a.number)
        data = data.slice(0, lul)
        let msg = [`本群${user_msg[2]}发言榜如下:\n--------`]
        let paiming = 0
        for (let item of data) {
            paiming++
            msg.push(`\n第${paiming}名：${item.nickname}·${item.number}次`)
        }
        await this.send_msg(e,msg)
        return true
    }
    async send_msg(e, msg){
        let userInfo = {
            user_id: e.user_id,
            nickname:"龙王爱好者"
        }
        let msgs = []
        msgs.push({
            ...userInfo,
            message:msg
        })
        let forwardMsg
        if (e.isGroup) {
        forwardMsg = await this.e.group.makeForwardMsg(msgs)
        } else {
        forwardMsg = await this.e.friend.makeForwardMsg(msgs)
        }
        forwardMsg.data = JSON.stringify(forwardMsg.data)
        forwardMsg.data = JSON.parse(forwardMsg.data)
        this.reply(forwardMsg)
    }
    async snots(e){
        if(!fs.existsSync(`./data/${e.group_id}_snots`)) {
            fs.mkdirSync(`./data/${e.group_id}_snots`)
        }
        let data;
        let date = await gettoday()
        try {
            data = fs.readFileSync(`./data/${e.group_id}_snots/${date}.json`, `utf-8`)
            data = JSON.parse(data)
        } catch {
            data = []
        }
        let temp_data = []
        for (let item of data) {
            if(item.user_id == e.user_id) temp_data.push(item)
        }
        if (temp_data.length > 0) {
            await deljson(temp_data[0], `./data/${e.group_id}_snots/${date}.json`)
            await autochuli(temp_data, `./data/${e.group_id}_snots/${date}.json`)
        } else {
            let user_data = {
                user_id: e.user_id,
                nickname: e.nickname,
                number: 1
            }
            data.push(user_data)
            data = JSON.stringify(data, null, 3)
            fs.writeFileSync(`./data/${e.group_id}_snots/${date}.json`, data, `utf-8`)
        }
        let month = await getmonth()
        try {
            data = fs.readFileSync(`./data/${e.group_id}_snots/${month}.json`, `utf-8`)
            data = JSON.parse(data)
        } catch {
            data = []
        }
        temp_data = []
        for (let item of data) {
            if(item.user_id == e.user_id) temp_data.push(item)
        }
        if(temp_data.length > 0) { 
            await deljson(temp_data[0], `./data/${e.group_id}_snots/${month}.json`)
            await autochuli(temp_data, `./data/${e.group_id}_snots/${month}.json`)
        } else {
            let user_data = {
                user_id: e.user_id,
                nickname: e.nickname,
                number: 1
            }
            data.push(user_data)
            data = JSON.stringify(data, null, 3)
            fs.writeFileSync(`./data/${e.group_id}_snots/${month}.json`, data, `utf-8`)
        }
        return false
    }
    async 发言次数可视化(e){
        let imgPath = await getGroupTotalChart(e.group_id, 14);
        await e.reply(segment.image(imgPath),1)
        fs.unlink(imgPath, err => {
            if (err) console.error('图片删除失败:', err);
          });
        return true
    }
    async 个人发言次数可视化(e){
        let user_id = e.user_id
        let 昵称 = this.e.sender.nickname
        for (let msg of e.message){
            if (msg.type == 'at'){
                user_id = msg.qq;
                昵称 = msg.text
                break;
            }
        }
        if(user_id === Bot.uin){
            e.reply("本人从未水过群，望周知")
            return true
        }
        let imgPath = await getUserChart(e.group_id, user_id, 昵称, 14);
        await e.reply(segment.image(imgPath) ,1)
        fs.unlink(imgPath, err => {
            if (err) console.error('图片删除失败:', err);
          });
        return true
    }
}

async function autochuli(data, filePath) {
    data[0].number++
    let new_data = fs.readFileSync(filePath, `utf-8`)
    new_data = JSON.parse(new_data)
    new_data.push(data[0])
    new_data = JSON.stringify(new_data, null, 3)
    fs.writeFileSync(filePath, new_data)
}
/**
 * 删除JSON数组内容
 * @param {*} deldata 要删除的数据
 * @param {string} filePath 路径
 */
async function deljson(deldata, filePath) {
    try {
        let data = fs.readFileSync(filePath, 'utf-8');
        data = JSON.parse(data);
        if (!Array.isArray(data)) return false;
        let filteredData = []
        for (let item of data) {
            item = JSON.stringify(item)
            deldata = JSON.stringify(deldata)
            if(item != deldata) {
                item = JSON.parse(item)
                filteredData.push(item)
                deldata = JSON.parse(deldata)
            }
        }

        const tempData = JSON.stringify(filteredData, null, 3);
        fs.writeFileSync(filePath, tempData, 'utf-8');
        return true;
    } catch (error) {
        console.error('Error processing the file', error);
        return false;
    }
}

async function gettoday(){
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
    const day = currentDate.getDate().toString().padStart(2, '0');
    const date_time = `${year}-${month}-${day}`;
    return date_time;
}

async function getmonth() {
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
    const date_time = `${year}-${month}`;
    return date_time;
}

async function getYesterday() {
    const currentDate = new Date();
    currentDate.setDate(currentDate.getDate() - 1); // 设置为昨天
    const year = currentDate.getFullYear();
    const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
    const day = currentDate.getDate().toString().padStart(2, '0');
    const date_time = `${year}-${month}-${day}`;
    return date_time;
}

async function getLastMonth() {
    const currentDate = new Date();
    currentDate.setMonth(currentDate.getMonth() - 1); // 设置为上个月
    const year = currentDate.getFullYear();
    const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
    const date_time = `${year}-${month}`;
    return date_time;
}

function readDailyData(groupId, dateStr) {
    const filePath = `./data/${groupId}_snots/${dateStr}.json`;
    if (!fs.existsSync(filePath)) return [];
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
      return [];
    }
  }
  
async function getGroupTotalChart(groupId, days = 7) {
    const labels = [];
    const data = [];
  
    for (let i = days - 1; i >= 0; i--) {
      const dateStr = dayjs().subtract(i, 'day').format('YYYY-MM-DD');
      labels.push(dateStr);
      const dayData = readDailyData(groupId, dateStr);
      data.push(dayData.reduce((sum, u) => sum + (u.number || 0), 0));
    }
  
    return await renderChart(labels, data, `群发言数统计`);
  }
  
async function getUserChart(groupId, userId, username, days = 30) {
    const labels = [];
    const data = [];
  
    for (let i = days - 1; i >= 0; i--) {
      const dateStr = dayjs().subtract(i, 'day').format('YYYY-MM-DD');
      labels.push(dateStr);
      const dayData = readDailyData(groupId, dateStr);
      const user = dayData.find(u => u.user_id === userId);
      data.push(user ? user.number : 0);
    }
  
    return await renderChart(labels, data, `${username}的水群数统计`);
  }
  
  async function renderChart(labels, data, name) {
    const config = {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: '发言次数',
          data,
          borderColor: 'rgba(54, 162, 235, 1)',
          backgroundColor: 'rgba(54, 162, 235, 0.2)',
          fill: true,
          tension: 0.2,
        }]
      },
      options: {
        plugins: {
          title: {
            display: true,
            text: name
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: { display: true, text: '发言数' }
          },
          x: {
            title: { display: true, text: '日期' }
          }
        }
      }
    };
  
    const buffer = await chartJSNodeCanvas.renderToBuffer(config);
  
    // 临时保存路径
    const tempDir = './data/temp';
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
    const filename = `${name}-${Date.now()}.png`;
    const fullPath = path.join(tempDir, filename);
  
    fs.writeFileSync(fullPath, buffer);
    return fullPath;
  }