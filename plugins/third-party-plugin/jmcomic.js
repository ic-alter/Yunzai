import _ from 'lodash'
import puppeteer from '../../lib/puppeteer/puppeteer.js'
import plugin from '../../lib/plugins/plugin.js'
import cfg from '../../lib/config/config.js'//可用于获取masterqq
import fs from 'fs';
import path from 'path';
import { Gfs } from 'icqq';

// 构造保存路径：process.cwd() + '/data/jmcomic'
const saveDir = path.join(process.cwd(), 'data', 'jmcomic');

const baseUrl = 'http://127.0.0.1:12315'

const whitelist = [571436194,824725200,781047800]
const usewhitelist = true

export class example extends plugin {
    constructor() {
        super({
            /** 功能名称 */
            name: "jmcomic",
            /** 功能描述 */
            dsc: "jm下载",
            /** https://oicqjs.github.io/oicq/#events */
            event: "message",
            /** 优先级，数字越小等级越高 */
            priority: 5000,
            rule: [
                {
                    /** 命令正则匹配 */
                    reg: "^#?jm[0-9]+$",
                    /** 执行方法 */
                    fnc: "jm",
                },
                {
                    /** 命令正则匹配 */
                    reg: "^#?jmzip[0-9]+$",
                    /** 执行方法 */
                    fnc: "jmzip",
                },
                {
                    /** 命令正则匹配 */
                    reg: "^#?jmhelp$",
                    /** 执行方法 */
                    fnc: "jmhelp",
                },
            ],
        });
    }

    async jm(e) { 
        if(usewhitelist && !whitelist.includes(e.group_id)){
            return e.reply("仅可在开放权限的群中使用")
        }
        const regex = /^#?jm(\d+)$/;
        const match = e.msg.match(regex);
        if (!match) {
            return e.reply("格式错误，请输入数字形式的jm号");
        }
        
        const comicId = match[1];  // 提取到的数字部分
        console.log(`接收到漫画ID：${comicId}`);
        try{
            // 调用下载函数，等待pdf下载完成
            await downloadComicPdf(comicId);
        } catch(error) {
            return e.reply("下载暂不可用或jm号不存在，请稍后再试")
        }
        try {
            // 构造pdf文件的完整路径
            const filePath = path.join(saveDir, `${comicId}.pdf`);
            
            // 下载成功后回复文件消息
            let gid = e.group_id
            let gfs = e.group.fs
            await gfs.upload(filePath)
            //e.reply([segment.file(filePath)]);
        } catch (error) {
            if(error.message === 'group space not enough'){
                e.reply("群文件空间不够，无法发送")
            }
            else{
                console.error("下载或生成PDF出错:", error);
                e.reply("受到风控上传失败，请等待至少30分钟后再试");
            }
        }
    }

    async jmzip(e) { 
        if(usewhitelist && !whitelist.includes(e.group_id)){
            return e.reply("仅可在开放权限的群中使用")
        }
        const regex = /^#?jmzip(\d+)$/;
        const match = e.msg.match(regex);
        if (!match) {
            return e.reply("格式错误，请输入数字形式的jm号");
        }
        
        const comicId = match[1];  // 提取到的数字部分
        console.log(`接收到漫画ID：${comicId}`);
        try {
           // 调用下载函数，等待pdf下载完成
           await downloadComicZip(comicId); 
        } catch (error) {
            return e.reply("下载暂不可用或jm号不存在，请稍后再试")
        }
        
        try {
            
            // 构造pdf文件的完整路径
            const filePath = path.join(saveDir, `${comicId}.zip`);
            
            // 下载成功后回复文件消息
            let gid = e.group_id
            let gfs = e.group.fs
            await gfs.upload(filePath)
            //e.reply([segment.file(filePath)]);
        } catch (error) {
            if(error.message === 'group space not enough'){
                e.reply("群文件空间不够，无法发送")
            }
            else{
                console.error("下载或生成ZIP出错:", error);
                e.reply("受到风控上传失败，请等待至少30分钟后再试");
            }
        }
    }
    async jmhelp(e){
        e.reply("1.输入jm+jm号即可触发下载，例如jm114514\n2.使用jmzip+jm号可下载压缩包形式\nnote:上传文件成功率较低且易被风控，请勿过度使用")
    }
}

async function downloadComicPdf(comicId) {
    // 确保目录存在
    fs.mkdirSync(saveDir, { recursive: true });
    const savePath = path.join(saveDir, `${comicId}.pdf`);
    if (fs.existsSync(savePath)) {
        console.log(`文件 ${comicId}.pdf 已存在，跳过下载。`);
        return;
    }
    // 根据你的实际情况修改服务端地址和端口
    const url = `${baseUrl}/comic/${comicId}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`请求错误: ${response.status} - ${response.statusText}`);
    }
    
    // 获取返回的 pdf 数据
    const buffer = await response.arrayBuffer();
    const pdfBuffer = Buffer.from(buffer);
    
    
    fs.writeFileSync(savePath, pdfBuffer);
    
    console.log(`PDF 文件已保存至: ${savePath}`);
  }


  async function downloadComicZip(comicId) {
    // 确保目录存在
    fs.mkdirSync(saveDir, { recursive: true });
    const savePath = path.join(saveDir, `${comicId}.zip`);
    if (fs.existsSync(savePath)) {
        console.log(`文件 ${comicId}.zip 已存在，跳过下载。`);
        return;
    }
    // 根据你的实际情况修改服务端地址和端口
    const url = `${baseUrl}/comiczip/${comicId}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`请求错误: ${response.status} - ${response.statusText}`);
    }
    
    // 获取返回的 pdf 数据
    const buffer = await response.arrayBuffer();
    const pdfBuffer = Buffer.from(buffer);
    
    
    fs.writeFileSync(savePath, pdfBuffer);
    
    console.log(`ZIP 文件已保存至: ${savePath}`);
  }