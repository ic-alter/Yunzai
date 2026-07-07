import plugin from '../../lib/plugins/plugin.js'
import { spawn } from 'child_process'
import { StringDecoder } from 'string_decoder'

const scriptPath = '/sdb/icalter/bot/icalter_startnapcat.sh'

function runNapCatRestart(qq) {
  return new Promise((resolve) => {
    const child = spawn('bash', [scriptPath, '-q', qq])
    const output = []
    const stdoutDecoder = new StringDecoder('utf8')
    const stderrDecoder = new StringDecoder('utf8')

    child.stdout.on('data', data => output.push(stdoutDecoder.write(data)))
    child.stderr.on('data', data => output.push(stderrDecoder.write(data)))
    child.on('error', error => output.push(error.message))
    child.on('close', () => {
      output.push(stdoutDecoder.end(), stderrDecoder.end())
      resolve(output.join(''))
    })
  })
}

export class ReviveNapCat extends plugin {
  constructor() {
    super({
      name: '复活NapCat',
      dsc: '#复活 <QQ号>',
      event: 'message',
      priority: 5000,
      rule: [
        {
          reg: '^#复活(?:\\s+(.+))?$',
          fnc: 'revive',
          permission: 'master'
        }
      ]
    })
  }

  async revive(e) {
    const qq = e.msg.replace(/^#复活\s*/, '').trim()

    if (!qq) {
      await e.reply('请提供要复活的QQ号，例如：#复活 2059536719')
      return true
    }

    if (!/^\d+$/.test(qq)) {
      await e.reply('QQ号必须为纯数字')
      return true
    }

    const output = await runNapCatRestart(qq)

    await e.reply(output)
    return true
  }
}
