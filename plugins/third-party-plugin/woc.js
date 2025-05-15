/**
 * 指令：#woc 或者woc
 * 效果：发送转发消息，包含一些攒劲图片
 */

import plugin from '../../lib/plugins/plugin.js'

export class example extends plugin {
  constructor() {
    super({
      name: 'ys-woc-Reborn',
      dsc: 'ys-woc-Reborn',
      event: 'message',
      priority: 5000,
      rule: [
        {
          reg: '^#?woc',
          fnc: 'woc'
        }
      ]
    })
  }

  async woc(e) {
    let urls = []
    // 尝试读取缓存的图片链接
    let redisPicArr = await redis.get('ys:woc:pic')
    Bot.logger.info('类型为=' + typeof redisPicArr + '值为=' + redisPicArr)
    if (redisPicArr == null || redisPicArr === '[]') {
        logger.mark('没有缓存，正在重新获取图片链接...')
      let randomPicGroup = 1 + Math.floor(Math.random() * 50)
      let f = await fetch(`https://yingtall.com/wp-json/wp/v2/posts?page=${randomPicGroup}`)
      let j = await f.json()
      let urlsArr = []
      j.forEach(item => {
        let context = item.content.rendered
        // 使用正则表达式匹配URL
        let regex = /(http[a-zA-Z0-9:/._-]+\.jpg)/g
        let urls = context.match(regex)
        // 把URL放到数组中
        urlsArr.push(urls)
      })
      await redis.set('ys:woc:pic', JSON.stringify(urlsArr))
      redisPicArr = await redis.get('ys:woc:pic')
    }
    // 如果redis中有缓存，就读取缓存
    if (redisPicArr != null) {
      logger.mark('正在从缓存中获取图片链接...')
      let parseArr = JSON.parse(redisPicArr)
      // 得到第一个图片链接数组，并去除第一个元素
      urls = parseArr.shift()
      Bot.logger.info(urls)
      await redis.set('ys:woc:pic', JSON.stringify(parseArr))
      // 打印匹配到的URL
      let fakeMsgArr = []
      urls.forEach(url => {
        fakeMsgArr.push({
          user_id: e.member.user_id,
          nickname: e.member.nickname,
          message: segment.image(url)
        })
      })
      let makeForwardMsg = e.group.makeForwardMsg(fakeMsgArr)
      e.reply(makeForwardMsg)
    }
  }
}