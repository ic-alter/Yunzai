import fs from 'fs';
import puppeteer from '../../lib/puppeteer/puppeteer.js';
import fetch from 'node-fetch';

//const html = await (await fetch('https://gitee.com/Tloml-Starry/resources/raw/master/resources/html/messageBoard.html')).text()
if (!fs.existsSync('data/MessageBoard')) fs.mkdirSync('data/MessageBoard');
if (!fs.existsSync('resources/html')) fs.mkdirSync('resources/html');
if (!fs.existsSync('data/MessageBoard/MessageBoard.json')) fs.writeFileSync('data/MessageBoard/MessageBoard.json', '[]');
if (!fs.existsSync('resources/html/messageBoard.html')) fs.writeFileSync('resources/html/messageBoard.html', html);
export class MessageBoard extends plugin {
    constructor() {
        super({
            name: 'messageBoard',
            dsc: '留言板',
            event: 'message',
            priority: 1,
            rule: [
                { reg: /^(#)?查看留言板(\d+)?$/, fnc: 'showMessageBoard' },
                { reg: /^留言\s+([\s\S]+)$/, fnc: 'addMessage' },
                { reg: /^点赞留言\s+(\d+)$/, fnc: 'likeMessage' },
                { reg: /^热门留言$/, fnc: 'showTopMessages' },
                { reg: /^删除留言\s+(\d+)$/, fnc: 'deleteMessage' }
            ]
        })
    }

    async showMessageBoard(e) {
        const messageBoardData = JSON.parse(fs.readFileSync('data/MessageBoard/MessageBoard.json', 'utf8'));
        messageBoardData.reverse();

        const page = e.msg.match(/^#?查看留言板(\d+)?$/)[1] || 1;
        const pageSize = 30;
        const start = (page - 1) * pageSize;
        const end = start + pageSize;
        const paginatedData = messageBoardData.slice(start, end);

        const messageBoardImage = await puppeteer.screenshot('messageBoard', {
            tplFile: 'resources/html/messageBoard.html',
            data: JSON.stringify(paginatedData, null, 2)
        });

        e.reply(messageBoardImage);
    }

    async addMessage(e) {
        const message = e.msg.match(/^留言\s+([\s\S]+)$/)[1];

        const forbiddenPatterns = [
            /*/[<>]/,
            /https?:\/\/[^\s]+/,
            /\d{10,}/,
            /m|c/ // 骂人违禁词，多个请用  | 隔开*/
        ];

        if (forbiddenPatterns.some(pattern => pattern.test(message))) {
            e.reply('留言包含不允许的内容，请修改后再试。');
            return;
        }

        const messageBoardData = JSON.parse(fs.readFileSync('data/MessageBoard/MessageBoard.json', 'utf8'));

        const newMessage = {
            id: messageBoardData.length ? messageBoardData[messageBoardData.length - 1].id + 1 : 1,
            name: e.sender.nickname || e.sender.user_id,
            content: message,
            avatar: `https://q1.qlogo.cn/g?b=qq&s=0&nk=${e.user_id}` || 'https://via.placeholder.com/50',
            timestamp: new Intl.DateTimeFormat('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false,
                timeZone: 'Asia/Shanghai'
            }).format(new Date()).replace(/\//g, '-').replace(',', ''),
            likes: 0
        };

        messageBoardData.push(newMessage);
        fs.writeFileSync('data/MessageBoard/MessageBoard.json', JSON.stringify(messageBoardData, null, 2));
        e.reply('留言已添加！');
    }

    async likeMessage(e) {
        const messageId = parseInt(e.msg.match(/^点赞留言\s+(\d+)$/)[1], 10);
        const messageBoardData = JSON.parse(fs.readFileSync('data/MessageBoard/MessageBoard.json', 'utf8'));

        const message = messageBoardData.find(msg => msg.id === messageId);
        if (message) {
            if (!message.likedUsers) {
                message.likedUsers = [];
            }
            if (message.likedUsers.includes(e.user_id)) {
                e.reply(`您已经点赞过ID为 ${messageId} 的留言。`);
                return;
            }

            message.likedUsers.push(e.user_id);
            message.likes = (message.likes || 0) + 1;
            fs.writeFileSync('data/MessageBoard/MessageBoard.json', JSON.stringify(messageBoardData, null, 2));
            e.reply(`留言ID ${messageId} 点赞成功！`);
        } else {
            e.reply(`未找到ID为 ${messageId} 的留言。`);
        }
    }

    async showTopMessages(e) {
        const messageBoardData = JSON.parse(fs.readFileSync('data/MessageBoard/MessageBoard.json', 'utf8'));
        const topMessages = messageBoardData
            .sort((a, b) => b.likes - a.likes)
            .slice(0, 10);

        const topMessagesData = JSON.stringify(topMessages, null, 2);
        const topMessagesImage = await puppeteer.screenshot('topMessages', {
            tplFile: 'resources/html/topMessages.html',
            data: topMessagesData
        });

        e.reply(topMessagesImage);
    }

    async deleteMessage(e) {
        if (!e.isMaster) {
            e.reply("您没有权限删除留言");
            return;
        }
        const messageId = parseInt(e.msg.match(/^删除留言\s+(\d+)$/)[1], 10);
        const messageBoardData = JSON.parse(fs.readFileSync('data/MessageBoard/MessageBoard.json', 'utf8'));

        const message = messageBoardData.find(msg => msg.id === messageId);
        if (message) {
            message.content = "<<<该留言违反规则，已被删除>>>";
            fs.writeFileSync('data/MessageBoard/MessageBoard.json', JSON.stringify(messageBoardData, null, 2));
            e.reply(`留言ID ${messageId} 已被删除。`);
        } else {
            e.reply(`未找到ID为 ${messageId} 的留言。`);
        }
    }
}