import { segment } from '../../lib/modules/oicq/index.js'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'

const COMMAND = /^(?:烟雾镜|芜|芜啸|芜~啸|尻尾|嗷|烟宝|靠)$/
const AUDIO_URLS = [
  'https://static.atlasacademy.io/CN/Audio/Servants_604700/0_B190.mp3',
  'https://static.atlasacademy.io/CN/Audio/Servants_604700/0_B420.mp3',
  'https://static.atlasacademy.io/CN/Audio/Servants_604700/1_B010.mp3',
  'https://static.atlasacademy.io/CN/Audio/Servants_604700/1_B020.mp3',
  'https://static.atlasacademy.io/CN/Audio/Servants_604700/1_B030.mp3',
  'https://static.atlasacademy.io/CN/Audio/Servants_604700/1_B910.mp3',
  'https://static.atlasacademy.io/CN/Audio/Servants_604700/1_B2010.mp3',
  'https://static.atlasacademy.io/CN/Audio/Servants_604700/1_B2020.mp3',
  'https://static.atlasacademy.io/CN/Audio/Servants_604700/1_B2030.mp3',
  'https://static.atlasacademy.io/CN/Audio/Servants_604700/1_B2410.mp3',
  'https://static.atlasacademy.io/CN/Audio/Servants_604700/1_B2420.mp3',
  'https://static.atlasacademy.io/CN/Audio/Servants_604700/12_B410.mp3',
  'https://static.atlasacademy.io/CN/Audio/Servants_604700/12_B2010.mp3'
]

const pick = () => AUDIO_URLS[Math.floor(Math.random() * AUDIO_URLS.length)]
function runFfmpeg (args) {
  return new Promise((resolve, reject) => {
    const process = spawn('ffmpeg', ['-y', '-loglevel', 'error', ...args])
    let error = ''
    process.stderr.on('data', data => { error += data })
    process.on('error', reject)
    process.on('close', code => code === 0 ? resolve() : reject(new Error(error || `ffmpeg exited with code ${code}`)))
  })
}

async function downloadAudio (url, file) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`下载音效失败：HTTP ${response.status}`)
  await writeFile(file, Buffer.from(await response.arrayBuffer()))
}

async function combineAudio (urls, directory) {
  const uniqueUrls = [...new Set(urls)]
  const files = new Map()
  await Promise.all(uniqueUrls.map(async (url, index) => {
    const file = join(directory, `${index}.mp3`)
    await downloadAudio(url, file)
    files.set(url, file)
  }))

  const inputs = urls.flatMap(url => ['-i', files.get(url)])
  const gaps = urls.slice(1).map((_, index) =>
    `anullsrc=r=44100:cl=mono:d=0.1[gap${index}]`
  ).join(';')
  const concatInputs = urls.map((_, index) =>
    `[${index}:a]${index < urls.length - 1 ? `[gap${index}]` : ''}`
  ).join('')
  const output = join(directory, '烟雾镜.mp3')

  await runFfmpeg([
    ...inputs,
    '-filter_complex', `${gaps};${concatInputs}concat=n=${urls.length * 2 - 1}:v=0:a=1[a]`,
    '-map', '[a]', '-ac', '1', '-ar', '44100', '-c:a', 'libmp3lame', '-q:a', '4', output
  ])
  return output
}

export class 烟雾镜音效 extends plugin {
  constructor () {
    super({
      name: '烟雾镜音效',
      dsc: '发送烟雾镜语音音效',
      event: 'message',
      priority: 5000,
      rule: [{ reg: COMMAND, fnc: 'sendAudio' }]
    })
  }

  async sendAudio (e) {
    const chance = Math.random()
    const urls = chance < 0.2
      ? Array(5).fill(pick())
      : chance < 0.5
        ? Array.from({ length: 3 }, pick)
        : chance < 0.8
          ? Array.from({ length: 5 }, pick)
          : Array(20).fill(pick())
    const directory = await mkdtemp(join(tmpdir(), 'yunzai-wu-'))

    try {
      const file = await combineAudio(urls, directory)
      return await e.reply(segment.record(file))
    } catch (error) {
      logger.error('[烟雾镜音效] 生成语音失败', error)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  }
}
