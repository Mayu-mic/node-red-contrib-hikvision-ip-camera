# Hikvision ip camera client for Node-RED

hikvision IP Camera (体温検知機能付き) 用のノードです。

v2.0.0 から Web API (AlertStream) 経由でデータを取得するようになりました。

## インストール方法

1. コードをクローンします。

```bash
git clone http://github.com/Mayu-mic/node-red-contrib-hikvision-ip-camera.git
cd node-red-contrib-hikvision-ip-camera
```

2. 依存ライブラリをインストールし、ノードをビルドします。

```bash
npm install
```

3. node_modules に登録します。

```bash
npm link
```

## アンインストール方法

```bash
npm unlink
```

## Hikvision Camera Event ノード

v2.0.0 から全てのAlertイベントを送出します。  
顔検知を行いたい場合は `msg.payload.AccessControllerEvent.subEventType` をフィルターしてください。
フィルターするコードはマニュアルの `Access Control Event Types` を参照してください。
