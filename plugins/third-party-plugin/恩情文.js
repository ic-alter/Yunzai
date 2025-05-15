import plugin from "../../lib/plugins/plugin.js";
import fetch from 'node-fetch';

export class example extends plugin {
    constructor() {
        super({
            /** 功能名称 */
            name: "恩情文",
            /** 功能描述 */
            dsc: "生成恩情文",
            /** https://oicqjs.github.io/oicq/#events */
            event: "message",
            /** 优先级，数字越小等级越高 */
            priority: 5000,
            rule: [
                {
                    /** 命令正则匹配 */
                    reg: "^#?恩情文",
                    /** 执行方法 */
                    fnc: "enqing",
                },
            ],
        });
    }

    async enqing(e) {
        let msg = e.message[0].text;
        let keyword = "";

        keyword = msg.split("恩情文")[1] //|| msg.split("hhsh")[1].trim();
        //检查keyword是否包含中文
        if (keyword == "") {
            e.reply(`请输入恩情文的主角`);
            return false;
        }
        if (keyword.length > 16){
            e.reply(`关键词过长！`);
            return false;
        }
        e.reply("生成中，请耐心等待");
        var replyMsg = ``;
        replyMsg = await getChatGPTResponse(keyword);
        e.reply(replyMsg);
        return false
    }
}

async function getChatGPTResponse(text) {
    //const apiKey = "sk-2jmlcqGXDcF09v5d2S1RBu87DG1bA2fjeAQ5IHNoaok2uTBs";  // 替换为你的 OpenAI API 密钥
    //const openAiBaseUrl = "https://api.chatanywhere.tech/v1/chat/completions";  // OpenAI API 端点
    const apiKey = "sk-NsqUk99pbA6ptoClLiwvpeBvQC5aJt2xuSWLMYAe03ErJWjq"
    const openAiBaseUrl = "https://api.gptoai.cc/v1/chat/completions"
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    };
    let prompt = `从中国访问回来金正日爷爷全然不顾身体的疲惫，连夜找我们几个小标兵商量儿童日的安排。谈得晚了，便送我们出门，要司机送我们回家。
在去大门口的路上，我们说：“ 金爷爷，您回去休息吧。您刚从中国回来。” 
金爷爷摇摇头，“不碍事，你们知道现在国际上有很多人把社会主义当作敌人，不断给我们制造麻烦，你们是祖国的未来，你们的事情便是国家的事情，是头等大事。”
我们 都激动了，眼里噙着泪花。多好的金爷爷呀。 
金爷爷抬头看看天空说：“如果世界真象这天空这么安静就好了，但是就有一些国家，像美国，要搞乱这个世界，他们是罪人。” 
说着，金爷爷弯下腰，从花池里捡出一颗石子，然后看着天空说：“该死的美国佬。” 
说着他把石子奋力向上一掷。很快就见空中一颗卫星突然爆发出耀眼的强光，然后就坠落了下来。“这是美国的间谍卫星，他们一直在平壤上空盘旋，侵犯我们的主权，我已经忍了很久了。”金爷爷愤愤地说。小朋友们都鼓起掌来，为祖国有这样的领导人感到自豪。 
一会金爷爷叫来秘书问：“那个卫星落到什么地方了？”
“好像是龙川一带。”秘书说。 
金爷爷一怔，说：“赶紧派人去查，看有什么问题没有。”之后爷爷送我们到大门口， 一直挥手到看不见我们。 
第四天我们听说龙川那边出事了，我们很紧张。而这时金爷爷叫我们过去。 
他依然那么慈祥，让我们坐下说：“战争总是要有牺牲的。为民族独立事业牺牲的人是伟大的。”
他这时低下头说：“但我必须承认，我当时击落敌人卫星的行为太鲁莽了， 我在这里向全国人们道歉。我将向全国人民说明情况。” 
我们顿时热泪盈眶，多好的爷爷呀，他在跟敌人斗争过程中的小失误竟然被他记在心里，还道了歉，我们在将来的学习中一定要向金爷爷学，学他老人家那宽广的胸怀，和不耻下问的精神。
我想让你帮助我生成一篇恶搞的课文。请根据上面提供的原文和下面提供的关键词，以关键词对应的人或事物作为文章的主角，写一篇类似于上文的搞笑课文，要求内容应具有幽默、夸张、讽刺性，并且模仿经典课文的语言风格和结构。课文的情节需要符合一定的逻辑性，但要有搞笑和出乎意料的转折。请根据关键词进行创作。严格按照原文的结构。你只需要输出恶搞后的课文，不需要给出其他内容。关键词是：`
    const body = JSON.stringify({
      model: 'gpt-3.5-turbo',  // 使用适合的模型（如 Davinci 或 GPT-3.5-turbo）
      messages: [{"role":"user", "content":`${prompt} ${text}`}], // 将 prompt 和传入的文本组合
      max_tokens: 1000,            // 设置最大响应字数
      temperature: 0.8,           // 控制生成文本的创造性
    });
  
    try {
      const response = await fetch(openAiBaseUrl, {
        method: 'POST',
        headers: headers,
        body: body,
      });
      const data = await response.json();
  
      if (response.ok) {
        // 返回模型的回答
        console.log(data.choices[0].message.content)
        return data.choices[0].message.content;
      } else {
        // 如果请求失败，输出错误信息
        logger.mark('Error:', data.error.message);
        return 'Error'
      }
    } catch (error) {
      logger.mark('Request failed', error);
      return 'Error'
    }
  }