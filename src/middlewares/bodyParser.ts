import * as bodyParser from 'koa-body'
export default () => {
    return bodyParser({
        jsonLimit: '1mb',
        formLimit: '1mb',
        textLimit: '1mb',
        multipart: true,
        formidable: {
            maxFileSize: 10 * 1024 * 1024
        }
    })
}