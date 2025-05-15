//作者860563585
//项目地址https://gitee.com/HanaHimeUnica/yzjs
//使用前需要git clone --depth 1 -b wdcnl https://gitee.com/HanaHimeUnica/yzjs.git ./data/wdcnl
import _ from 'lodash'
import puppeteer from 'puppeteer'
import plugin from '../../lib/plugins/plugin.js'
import fs from 'fs'
import cfg from '../../lib/config/config.js'//可用于获取masterqq
import seedrandom from 'seedrandom'

const _path = process.cwd() + '/data/wdcnl'

export class example extends plugin {
  constructor() {
    super({
      /** 功能名称 */
      name: '美国大选',
      /** 功能描述 */
      dsc: '美国大选',
      priority: 1000,
      rule: [
        {
          reg: '^#?美国大选$',
          fnc: 'kkcnl'
        }
      ]
    })
  }

  async kkcnl() {
    let data = {
      tplFile: `https://view.inews.qq.com/activities/short-term/usElections2024.html?from=share`,
    }

    let url = "https://view.inews.qq.com/activities/short-term/usElections2024.html"
    await this.e.reply(segment.image(await render(url)))
    return true //返回true 阻挡消息不再往下
  }
}

async function render(url) {
    const browser = await puppeteer.launch({
        headless: "new",
        args: [
            '--disable-gpu',
            '--disable-setuid-sandbox',
            '--no-sandbox',
            '--no-zygote'
        ],
        timeout: 0,
        defaultViewport: {
            width: 1920,
            height: 1080
        }
    }).catch(error => console.error(error))
    const page = await browser.newPage()
    await page.goto(url)
    
    const screenshotOptions = {
        type: 'jpeg', // 截图格式，默认为 png
        fullPage: true, // 是否截取整个页面，默认为 false
        omitBackground: true, // 是否移除背景颜色或图片，默认为 false
        quality: 100, // 设置 JPEG 图像的质量（0-200），默认是 80
        timeout: 90000, // 设置截图操作的超时时间为30秒
        waitUntil: 'networkidle0', // 等待页面中有2个或更少的网络连接处于活动状态
        path: `${_path}/temp.jpeg`, //设置encoding后不可用
    }

    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
      }
    await page.screenshot(screenshotOptions)
    await page.content()
    await page.screenshot(screenshotOptions)
    await page.content()
    await page.screenshot(screenshotOptions)
    await page.content()
    await page.screenshot(screenshotOptions)
    await browser.close()
    return fs.readFileSync(`${_path}/temp.jpeg`)
}
