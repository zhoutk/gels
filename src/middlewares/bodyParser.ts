import * as bodyParserPkg from 'koa-body'
export default () => {
    const bodyParser = ((bodyParserPkg as any).default ?? bodyParserPkg) as (options: any) => any
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