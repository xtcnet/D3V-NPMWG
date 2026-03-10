import * as api from "./base";

export async function getTables(): Promise<string[]> {
    return await api.get({
        url: "/database/tables",
    });
}

export async function getTableData(tableName: string, offset: number = 0, limit: number = 50): Promise<any> {
    return await api.get({
        url: `/database/tables/${tableName}`,
        params: { offset, limit },
    });
}
