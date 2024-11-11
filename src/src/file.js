const { invoke } = window.__TAURI__.tauri;

let currentConnection = null;
let currentPath = '/';

document.addEventListener('DOMContentLoaded', () => {
    currentConnection = JSON.parse(localStorage.getItem('currentConnection'));
    console.log('Current connection:', currentConnection);
    if (currentConnection) {
        loadFiles(currentPath);
    } else {
        console.error('No current connection found');
    }

    document.getElementById('uploadButton').addEventListener('click', () => {
        document.getElementById('fileUpload').click();
    });

    document.getElementById('fileUpload').addEventListener('change', uploadFile);
    document.getElementById('wgetDownloadButton').addEventListener('click', wgetDownload);
});

async function loadFiles(path) {
    try {
        console.log('Loading files for path:', path);
        const files = await invoke('get_remote_files', { connectionInfo: currentConnection, path });
        console.log('Received files:', files);
        displayFiles(files, path);
        currentPath = path;
    } catch (error) {
        console.error('Error loading files:', error);
        alert('Failed to load files: ' + error);
    }
}

function displayFiles(files, path) {
    const fileList = document.getElementById('fileList');
    fileList.innerHTML = '';
    document.getElementById('currentPath').textContent = path;

    const backToMainButton = document.createElement('button');
    backToMainButton.textContent = '返回app主页面';
    backToMainButton.onclick = () => {
        window.location.href = 'index.html';
    };
    fileList.appendChild(backToMainButton);

    if (path !== '/') {
        const upButton = document.createElement('button');
        upButton.textContent = '返回上一级';
        upButton.onclick = () => {
            currentPath = Path.dirname(currentPath);
            loadFiles(currentPath);
        };
        fileList.appendChild(upButton);
    }

    files.forEach(file => {
        if (file.name === '.' || file.name === '..' || file.name.includes('/')) {
            return;
        }

        const li = document.createElement('li');
        li.textContent = file.name;
        
        if (file.is_dir) {
            li.style.fontWeight = 'bold';
            li.onclick = () => {
                currentPath = Path.join(currentPath, file.name);
                loadFiles(currentPath);
            };
        }
        fileList.appendChild(li);
    });
}

async function wgetDownload() {
    const remoteFilePath = document.getElementById('remoteFilePath').value;
    const localFilePath = document.getElementById('localFilePath').value;

    if (!remoteFilePath || !localFilePath) {
        alert('Please enter both remote and local file paths');
        return;
    }

    try {
        await invoke('wget_download', { 
            connectionInfo: currentConnection, 
            remoteFilePath, 
            localFilePath 
        });
        alert('File downloaded successfully!');
    } catch (error) {
        console.error('Error downloading file:', error);
        alert('Failed to download file: ' + error);
    }
}



async function downloadFile(path) {
    try {
        const tempPath = await invoke('download_file', { connectionInfo: currentConnection, path });
        const suggestedFilename = Path.basename(path);
        
        const filePath = await save({
            defaultPath: suggestedFilename,
        });

        if (filePath) {
            await invoke('move_file', { src: tempPath, dst: filePath });
            alert('文件下载成功！'); // 显示下载成功消息
        }
    } catch (error) {
        console.error('下载文件时出错:', error);
        alert('文件下载失败: ' + error);
    }
}


async function uploadFile(event) {
    const file = event.target.files[0];
    if (!file) {
        console.log('No file selected');
        return;
    }

    console.log('File selected:', file.name);

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            console.log('File read successfully');
            const content = new Uint8Array(e.target.result);
            const path = Path.join(currentPath, file.name);
            console.log('Attempting to upload file to:', path);
            
            await invoke('upload_file', { 
                connectionInfo: currentConnection, 
                path, 
                content: Array.from(content) 
            });
            
            console.log('File upload successful');
            loadFiles(currentPath);  // Refresh the file list
        } catch (error) {
            console.error('Error uploading file:', error);
            alert('Failed to upload file: ' + error);
        }
    };

    reader.onerror = (error) => {
        console.error('Error reading file:', error);
        alert('Failed to read file: ' + error);
    };

    console.log('Starting to read file');
    reader.readAsArrayBuffer(file);
}

const Path = {
    join: (a, b) => a === '/' ? '/' + b : a + '/' + b,
    dirname: (path) => {
        if (path === '/') return '/';
        const parts = path.split('/');
        parts.pop();
        return parts.join('/') || '/';
    },
    basename: (path) => path.split('/').pop()
};