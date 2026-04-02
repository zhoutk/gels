export default interface TransElement {
    table: string;
    method: string;
    params: Record<string, unknown> | unknown[];
    sql?: string;
    id?: string | number;
}