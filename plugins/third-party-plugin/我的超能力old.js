//作者860563585
//项目地址https://gitee.com/HanaHimeUnica/yzjs
//使用前需要git clone --depth 1 -b wdcnl https://gitee.com/HanaHimeUnica/yzjs.git ./data/wdcnl
import _ from 'lodash'
import puppeteer from '../../lib/puppeteer/puppeteer.js'
import plugin from '../../lib/plugins/plugin.js'
import fs from 'fs'

const _path = process.cwd() + '/data/wdcnl'
const cnl = `${_path}/超能力/`;
const ds = `${_path}/但是/`;
const zy = `${_path}/主义/`;

export class example extends plugin {
  constructor() {
    super({
      /** 功能名称 */
      name: '我的超能力',
      /** 功能描述 */
      dsc: '我的超能力',
      priority: 1000,
      rule: [
        {
          reg: '^#*(我|他|她|它)的超?能力old$',
          fnc: 'kkcnl'
        },
        {
          reg: '^#*(定制|订制)超能力.*$',
          fnc: 'dzcnl'
        }
      ]
    })
  }

  async add_cnl(){
    //await fs.writeFileSync(dirpath + "/" + filename, JSON.stringify(local_json, null, "\t"));//写入文件
  }

  async kkcnl() {
    //超能力随机抽取
    let file = cnl
    let cnl_json = JSON.parse(fs.readFileSync(file + "cnl.json", "utf8"));//读取文件
    let random_index = Math.floor(Math.random() * cnl_json.length)
    let cnl_text = cnl_json[random_index]
    //副作用随机抽取
    let file1 = ds
    let ds_json = JSON.parse(fs.readFileSync(file1 + "ds.json", "utf8"));//读取文件
    let random_index2 = Math.floor(Math.random() * ds_json.length)
    let ds_text = ds_json[random_index2]
    //主义随机抽取
    let file2 = zy
    let number2 = Math.floor(Math.random() * (24 - 1) + 1)
    let zy_URL = file2 + number2.toString() + '.png'
    let data = {
      tplFile: `${_path}/wdcnl.html`,
      头像: await getAvatar(this.e),
      超能力: cnl_text,
      但是: ds_text,
      主义: zy_URL,
    }

    let img = await puppeteer.screenshot('wdcnl', data)
    if (img) await this.e.reply(_.concat(img),true)
    return true //返回true 阻挡消息不再往下
  }

  async dzcnl(){
    //定制超能力
    let name = this.e.msg.replace(/#| |定制|订制|超能力/g, "")
    if(name == ""||name.length > 20) {
        this.e.reply("请输入不多于20个字的超能力描述")
        return true
    }
    //副作用随机抽取
    let file1 = ds
    let ds_json = JSON.parse(fs.readFileSync(file1 + "ds.json", "utf8"));//读取文件
    let random_index2 = Math.floor(Math.random() * ds_json.length)
    let ds_text = ds_json[random_index2]
    //主义随机抽取
    let file2 = zy
    let number2 = Math.floor(Math.random() * (24 - 1) + 1)
    let zy_URL = file2 + number2.toString() + '.png'
    let data = {
      tplFile: `${_path}/wdcnl_old.html`,
      头像: await getAvatar(this.e),
      超能力: name,
      但是: ds_text,
      主义: zy_URL,
    }

    let img = await puppeteer.screenshot('wdcnl_old', data)
    if (img) await this.e.reply(_.concat(img), true)
    return true //返回true 阻挡消息不再往下

  }
}

async function getAvatar (e) {
  let userId = e.user_id
  if (typeof e.getAvatarUrl === 'function') {
    return await e.getAvatarUrl(0)
  }
  return `https://q1.qlogo.cn/g?b=qq&s=160&nk=${userId}`
}