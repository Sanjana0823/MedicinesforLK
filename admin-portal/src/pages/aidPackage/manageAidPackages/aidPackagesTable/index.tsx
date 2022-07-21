import { formatDate, formatMoney } from "helpers/formatter";
import { getSupplierQuoteForNeed } from "helpers/needsHelper";
import { useCallback, useMemo, useState } from "react";
import { useTable, useRowSelect } from "react-table";
import { AidPackage } from "types/AidPackage";
import { MedicalNeed } from "types/MedicalNeeds";
import { AidPackages, NeedAssignments } from "../../aidPackage";

export function AidPackageTable({
  aidPackages,
  setSelectedPackage,
  handleAidPkgPublish,
  medicalNeeds,
  needAssignments,
}: {
  aidPackages: AidPackages;
  setSelectedPackage: (supplierID: number | null) => void;
  handleAidPkgPublish: (
    supplierId: number,
    status: AidPackage.Status
  ) => Promise<void>;
  medicalNeeds: MedicalNeed[];
  needAssignments: NeedAssignments;
}) {
  const data = useMemo(
    () =>
      Object.keys(aidPackages)
        .filter((key) => {
          let supplierID = Number(key);
          return !aidPackages[supplierID].isPublished;
        })
        .map((key) => {
          let supplierID = Number(key);
          let supplier: string = "";
          let period: Date = new Date();

          const needsWithSupplier = Object.keys(needAssignments)
            .filter((needKey) => {
              const assignments = needAssignments[needKey];
              return assignments.has(supplierID);
            })
            .map(Number);

          const totalCost = needsWithSupplier.reduce((currentTotal, needID) => {
            const quote = getSupplierQuoteForNeed({
              medicalNeeds,
              needID,
              supplierID,
            });

            if (!quote) return currentTotal;

            period = new Date(
              quote.period.year,
              quote.period.month - 1,
              quote.period.year
            );
            supplier = quote.supplier.name;

            return (
              currentTotal +
              (quote?.unitPrice || 0) * needAssignments[needID].get(supplierID)!
            );
          }, 0);

          return {
            name: aidPackages[supplierID].name,
            supplierID,
            supplier,
            description: aidPackages[supplierID].details,
            period: period ? formatDate(period) : "",
            totalCost: formatMoney(totalCost),
            isPublished: aidPackages[supplierID].isPublished,
          };
        }),
    [aidPackages, needAssignments, medicalNeeds]
  );

  /**
   * calls the drilled in publish handler prop
   * and upon success removes the row.
   */
  const handlePublish = useCallback(
    (
      supplierId: number,
      status: AidPackage.Status,
      setIsUploading: (uploading: boolean) => void
    ) => {
      setIsUploading(true);
      handleAidPkgPublish(supplierId, status)
        .then(() => {
          setSelectedPackage(null);
        })
        .finally(() => {
          setIsUploading(false);
        });
    },
    [handleAidPkgPublish, setSelectedPackage]
  );

  const columns = useMemo(
    () => [
      {
        Header: "Name",
        accessor: "name",
      },
      {
        Header: "Supplier",
        accessor: "supplier",
      },
      {
        Header: "Description",
        accessor: "description",
      },
      {
        Header: "Period",
        accessor: "period",
      },
      {
        Header: "Total Cost",
        accessor: "totalCost",
      },
      {
        Header: "Actions",
        Cell: ({ row }: any) => {
          let [isUploading, setIsUploading] = useState(false);
          return !isUploading ? (
            <>
              <PublishAidPackageButton
                status={AidPackage.Status.Published}
                handlePublish={handlePublish}
                label="Publish"
                supplierID={row.original.supplierID}
                setIsUploading={setIsUploading}
              />
              <PublishAidPackageButton
                status={AidPackage.Status.Draft}
                handlePublish={handlePublish}
                label="Save Draft"
                supplierID={row.original.supplierID}
                setIsUploading={setIsUploading}
              />
            </>
          ) : (
            <p>Saving Aid Package...</p>
          );
        },
      },
    ],
    [handlePublish]
  );

  const tableInstance = useTable(
    {
      // @ts-ignore
      columns,
      data,
      autoResetSelectedRows: false,
    },
    useRowSelect
  );

  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    rows,
    prepareRow,
    // @ts-ignore
    toggleAllRowsSelected,
  } = tableInstance;
  return (
    <table {...getTableProps()}>
      <thead className="manage-package-header-row">
        {headerGroups.map((headerGroup) => (
          <tr {...headerGroup.getHeaderGroupProps()}>
            {headerGroup.headers.map((column) => (
              <th {...column.getHeaderProps()}>{column.render("Header")}</th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody {...getTableBodyProps()}>
        {rows.map((row) => {
          prepareRow(row);

          return (
            <tr
              {...row.getRowProps()}
              onClick={() => {
                setSelectedPackage(row.original.supplierID);
                toggleAllRowsSelected(false);
                // @ts-ignore
                row.toggleRowSelected(true);
              }}
              className={`manage-package-row ${
                // @ts-ignore
                row.isSelected && "manage-package-row--selected"
              }`}
            >
              {row.cells.map((cell) => {
                return <td {...cell.getCellProps()}>{cell.render("Cell")}</td>;
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function PublishAidPackageButton({
  handlePublish,
  supplierID,
  status,
  label,
  setIsUploading,
}: {
  handlePublish: Function;
  supplierID: number;
  status: AidPackage.Status;
  label: string;
  setIsUploading: Function;
}) {
  return (
    <button
      className={`table-action-button btn small ${
        status !== AidPackage.Status.Published && "secondary"
      }`}
      onClick={(event) => {
        event.stopPropagation();
        handlePublish(supplierID, status, setIsUploading);
      }}
    >
      {label}
    </button>
  );
}
