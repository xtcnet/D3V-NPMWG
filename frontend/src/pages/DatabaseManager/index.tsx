import { IconDatabase } from "@tabler/icons-react";
import { useState } from "react";
import { Badge, Card, Col, Container, Row, Table } from "react-bootstrap";
import { useQuery } from "@tanstack/react-query";
import { getTables, getTableData } from "src/api/backend";
import { HasPermission, Loading } from "src/components";
import { ADMIN, VIEW } from "src/modules/Permissions";

export default function DatabaseManager() {
	const [activeTable, setActiveTable] = useState<string | null>(null);

	const { data: tables, isLoading: tablesLoading } = useQuery({
		queryKey: ["database-tables"],
		queryFn: getTables,
	});

	const { data: tableData, isLoading: tableDataLoading } = useQuery({
		queryKey: ["database-table", activeTable, 0, 50],
		queryFn: () => getTableData(activeTable as string, 0, 50),
		enabled: !!activeTable,
	});

	// Select the first table by default when tables are loaded
	if (tables && tables.length > 0 && !activeTable) {
		setActiveTable(tables[0]);
	}

	const renderTableData = (data: any[]) => {
		if (!data || data.length === 0) return <div className="text-muted p-3">No data</div>;
		// In SQLite, raw SQL mapping might mismatch explicit schemas, so strictly read keys from the first row.
		const columns = Object.keys(data[0]);

		return (
			<div className="table-responsive">
				<Table striped bordered hover size="sm" className="mb-0 text-nowrap">
					<thead>
						<tr>
							{columns.map((col: string) => (
								<th key={col}>{col}</th>
							))}
						</tr>
					</thead>
					<tbody>
						{data.map((row: any, i: number) => (
							<tr key={i}>
								{columns.map((col: string) => (
									<td key={`${i}-${col}`}>
										{row[col] === null ? (
											<span className="text-muted">NULL</span>
										) : typeof row[col] === "object" ? (
											JSON.stringify(row[col])
										) : (
											String(row[col])
										)}
									</td>
								))}
							</tr>
						))}
					</tbody>
				</Table>
			</div>
		);
	};

	return (
		<HasPermission section={ADMIN} permission={VIEW}>
			<Container className="my-4" fluid>
				<div className="d-flex align-items-center mb-4">
					<IconDatabase size={28} className="me-2 text-primary" />
					<h2 className="mb-0">Database Manager</h2>
					<Badge bg="danger" className="ms-3 rounded-pill text-uppercase" style={{ letterSpacing: "1px" }}>
						Super Admin Only
					</Badge>
				</div>

				<Row>
					<Col md={3}>
						<Card className="shadow-sm">
							<Card.Header className="bg-body-tertiary text-body fw-bold">Tables</Card.Header>
							<div className="list-group list-group-flush" style={{ maxHeight: "70vh", overflowY: "auto" }}>
								{tablesLoading && <div className="p-3"><Loading /></div>}
								{tables?.map((table: string) => (
									<button
										key={table}
										className={`list-group-item list-group-item-action ${activeTable === table ? "active" : ""}`}
										onClick={() => setActiveTable(table)}
									>
										{table}
									</button>
								))}
							</div>
						</Card>
					</Col>
					<Col md={9}>
						<Card className="shadow-sm">
							<Card.Header className="bg-body-tertiary text-body d-flex justify-content-between align-items-center">
								<h5 className="mb-0 fw-bold">{activeTable || "Select a table"}</h5>
								{tableData && <Badge bg="secondary">{tableData.total} rows</Badge>}
							</Card.Header>
							<Card.Body className="p-0" style={{ maxHeight: "70vh", overflowY: "auto" }}>
								{tableDataLoading ? (
									<div className="p-5 d-flex justify-content-center"><Loading /></div>
								) : (
									tableData && renderTableData(tableData.rows)
								)}
							</Card.Body>
						</Card>
					</Col>
				</Row>
			</Container>
		</HasPermission>
	);
}
