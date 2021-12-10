import { IMidwayApplication } from '@midwayjs/core';
import { App, Init, Inject, Logger, Provide, Scope, ScopeEnum } from '@midwayjs/decorator';
import { ILogger } from '@midwayjs/logger';
import * as qiniu from 'qiniu';
import { CoolPlugin, ICoolFile, MODETYPE, PLUGINSTATUS } from '@cool-midway/core';
// @ts-ignore
import * as config from "./package.json";


@Provide()
@Scope(ScopeEnum.Request)
export class QiniuHandler implements ICoolFile {

    @Inject('cool:coolPlugin')
    coolPlugin: CoolPlugin;

    @App()
    app: IMidwayApplication;

    @Logger()
    coreLogger: ILogger;

    namespace: string

    @Init()
    async init() {
        this.namespace = config.name.split('/')[1];
        return await this.checkStatus();
    }


    private async createKey(filename, uploadFolder?) {


        let temp = filename.split('.');
        let lastName = '';
        let firstName = filename;
        if (temp.length > 1) {
            firstName = filename.substr(
                0,
                filename.length - temp[temp.length - 1].length - 1,
            );
        }
        lastName = '.' + temp[temp.length - 1];

        firstName = firstName.substr(0, Math.min(firstName.length, 10));
        let tmpfolder = uploadFolder || '';
        if (tmpfolder.length > 0 && tmpfolder.lastIndexOf('/') != tmpfolder.length - 1) {
            tmpfolder += '/';
        }
        if (tmpfolder.length > 0 && tmpfolder.indexOf('/') == 0) {
            tmpfolder = tmpfolder.substr(1);
        }

        let key =
            tmpfolder +
            firstName +
            '-' +
            require('uuid').v4() +
            lastName;

        return key;
    }

    async upload(ctx) {

        let { fileName, folder } = ctx.request.query;
        let key = await this.createKey(fileName, folder);
        const { accessKey, secretKey, bucket, zone, publicDomain } = await this.coolPlugin.getConfig(this.namespace);

        let qiniuDomain =
            publicDomain;
        if (!qiniuDomain.endsWith('/')) {
            qiniuDomain += '/'
        }


        var mac = new qiniu.auth.digest.Mac(accessKey, secretKey)
        var options = {
            scope: bucket + ':' + key,
            deadline: (Date.now() / 1000) ^ 0 + 3600,
        }
        var putPolicy = new qiniu.rs.PutPolicy(options)
        var uploadToken = putPolicy.uploadToken(mac)

        return new Promise(async (resolve, reject) => {
            resolve({
                uploadUrl: `https://up-${zone}.qiniup.com/`,
                publicUrl: `${qiniuDomain}${key}`,
                uploadData: {
                    token: uploadToken,
                    key,
                    fileKey: 'file',//一并由表单传过去的文件名字段
                }
            });

        })
    }
    async checkStatus() {
        const { accessKey, secretKey, bucket, zone, publicDomain } = await this.coolPlugin.getConfig(this.namespace);
        if (!accessKey || !secretKey || !bucket || !zone || !publicDomain) {
            return PLUGINSTATUS.NOCONF;
        }
        return PLUGINSTATUS.USABLE;
    }
    getMode() {
        return {
            mode: MODETYPE.CLOUD,
            type: 'qiniu'
        };
    }
    getMetaFileObj() {
        return {
            mode: MODETYPE.CLOUD,
            type: 'qiniu'
        };
    }
};
