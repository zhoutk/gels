export default interface TransElement {
    table: string;
    method: string;
    params: object | Array<any>;
    sql?: string;
    id?: string | number;
}