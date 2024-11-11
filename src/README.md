# Tauri + Vanilla

本app为shell管理文件，集成了文件管理（文件上传与下载）虚拟终端 一键黑页 一键不死马 的功能

# Start

在linux环境中, 使用 sudo ./run-in-container 进入程序(注意: 不是使用redknife文件打开程序), 请等待几分钟以建立docker环境, 随后会自动打开app

# Warning

本app尚为开发阶段，所以bug在所难免，也可能有许多因疏忽导致的错误，使得可能在我测试时可以使用的功能在您的主机上无法使用，还请多多包含

# Tip

参数请使用POST参数，
虚拟终端会卡一会，请多多等待，实在不行 右键 + back 返回主页后，重新进入

# Welcome

祝您使用愉快



# 吐槽

这个tauri的环境真是太搞人了，一开始建立环境的时候进行项目编译, 需要文件libwebkit2gtk-4.0-dev，结果tauri只能接受4.0版本的，找遍各种镜像, 结果都只有4.1，6.0版本，好不容易找到了, 但那个镜像源也只支持ubuntu ( libwebkit2gtk-4.0 not available in Ubuntu 24 & Debian 13 repositories #9662) ，所以我只好换成ubuntu进行开发，
在写好文件代码，调试好之后，因为tauri支持一键打包的功能，所以我在本机上运行成功后没多想就交了考核，但没想到tauri的bundle和静态链接只能打包了一部分环境，发现后我就开始使用appimage来打包剩下的环境文件，结果卡了好久，运行时, 一直告诉我 "Failed to execute child process “/usr/lib/x86_64-linux-gnu/webkit2gtk-4.0/WebKitNetworkProcess” "，最后发现原来是appimage与webkit2gtk冲突（AppImage built with webkit2gtk dependencies cannot start on non-Ubuntu distributions      #175)[https://github.com/AppImageCrafters/appimage-builder/issues/175]，
之后我就换成snap打包, 但结果也还是一样, 最后没有办法, 只好使用docker进行打包, 最终发现打开发现关也关不掉，只能放弃了

随后搭建windows环境, 万事大吉, 为什么我之前没有想到?不然也不同花这么多时间了 (哭)

