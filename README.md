# Hikvision ip camera client for Node-RED

hikvision IP Camera (体温検知機能付き) 用のノードです。

## 動作環境

Linux (64bit)

Windows/Mac/Raspberry Pi OS(32bit)環境では動作しません。

## インストール方法

1. コードをクローンします。

```bash
git clone http://github.com/Mayu-mic/node-red-contrib-hikvision-ip-camera.git
cd node-red-contrib-hikvision-ip-camera
```

2. 依存ライブラリをインストールし、クライアント・ノードをビルドします。

```bash
sudo apt install build-essential
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

## クライアントのリビルド

`client/src` 内にクライアントのソースコード(C++)が同梱されています。

`npm run build:client` でクライアントのリビルドが出来ます。

## Face Detection ノード

顔を検知し、登録された従業員番号と検温結果、画像を送信します。

### msg.payload

```ts
alermType: string
employeeId: number // -> 未登録の場合は0
temperature: number
isTemperatureAbnormal: boolean
picturePaths: {
  picture: string | null
  thermal: string | null
  visibleLight: string | null
}
```

