import pandas as pd
import csv
import os

def generate_csv(excel_file, output_dir):

    os.makedirs(output_dir, exist_ok=True)

    # 读取整个Excel
    xls = pd.ExcelFile(excel_file)

    print("Sheets found:", xls.sheet_names)

    for sheet_name in xls.sheet_names:
        if sheet_name == "temp":
            continue

        # df = pd.read_excel(xls, sheet_name=sheet_name, dtype=str)
        df = pd.read_excel(
            xls,
            sheet_name=sheet_name,
            keep_default_na=False,
            engine="openpyxl"
        )

        # 强制所有列转为字符串（关键）
        df = df.astype(str)

        # 防止sheet名带非法字符
        safe_name = sheet_name.replace("/", "_").replace("\\", "_")

        output_path = os.path.join(output_dir, f"{safe_name}.csv")

        df.to_csv(output_path, index=False, encoding="utf-8")
        print(f"Exported: {output_path}")

    print("Done.")


def generate_sql(file_path):
    print("==========   Generating SQL for: {} ==========".format(file_path))

    with open(file_path, newline="", encoding="utf-8") as f:
        reader = csv.reader(f)

        # 第一行：表名
        first_row = next(reader)
        table_name = first_row[1]

        # 第二行：header
        headers = next(reader)

        dict_reader = csv.DictReader(f, fieldnames=headers)

        columns = []
        pk = None
        indexes = []
        fks = []
        composite_uniques = {}
        checks = []


        for row in dict_reader:
            name = row["Name"]
            col_type = row["Type"]

            if not name:
                continue

            nullable = "NOT NULL" if row["Nullable"] == "N" else ""
            default = f"DEFAULT {row['Default']}" if row["Default"] else ""
            default = default.replace('"', "'")
            if row["Unique"] and row["Composite Unique"] == "":
                unique = "UNIQUE"
            else:
                unique = ""

            
            # collect column definitions
            col_def = f"    " + f"{name} {col_type} {nullable} {default} {unique}".strip()
            columns.append(col_def)

            if row["PK"] == "Y":
                pk = name

            if row["Index"] == "Y":
                indexes.append(name)

            if row["FK"] == "Y":
                ref = row["FK constraint"]

                fk_sql = f"""ALTER TABLE {table_name} ADD CONSTRAINT fk_{table_name}_{name} \n\tFOREIGN KEY ({name}) REFERENCES {ref};"""

                fks.append(fk_sql)

            # ===== collect Composite Unique =====
            if row["Composite Unique"]:
                key = row["Composite Unique"].strip()

                if key not in composite_uniques:
                    composite_uniques[key] = []

                composite_uniques[key].append(name)
            
            # collect CHECK constraints
            if row.get("Check Constraint"):
                expr = row["Check Constraint"].replace('"', "'").strip()

                check_sql = f"""ALTER TABLE {table_name} ADD CONSTRAINT chk_{table_name}_{name} \n    CHECK ({expr});"""

                checks.append(check_sql)


    sql = f"CREATE TABLE {table_name} (\n"
    sql += ",\n".join(columns)


    if pk:
        sql += f",\n\n    PRIMARY KEY ({pk})"

    if composite_uniques != {}:
        # ===== Composite Unique =====
        for cname, cols in composite_uniques.items():
            col_list = ", ".join(cols)
            # CONSTRAINT uq_account_user UNIQUE (account_id, user_id)
            sql += f""",\n    CONSTRAINT {cname} UNIQUE ({col_list})"""
    

    sql += "\n);\n"

    for idx in indexes:
        sql += f"CREATE INDEX idx_{table_name}_{idx} ON {table_name}({idx});\n"

    for chk in checks:
        sql += chk + "\n"

    print(sql)

    return sql, fks

if __name__ == "__main__":
    
    
    excel_file = "databases.xlsx"   # excel file
    csv_dir = "csv"   # csv output dir
    generate_csv(excel_file, csv_dir)

    print("******************************************************************")
    print("******************   csv generation completed   ******************")
    print("******************************************************************")

    # get all file names in ./csv/
    sql_summary = ""
    fk_summary = ""
    
    csv_files = [f for f in os.listdir(csv_dir) if f.endswith(".csv")]
    for file_path in csv_files:
        # print(file_path)
        sql, fks = generate_sql("./csv/"+file_path)
        sql_summary += sql + "\n\n"

        if fks:
            # foreign key constraints should be added after all tables are created
            fk_summary += "\n".join(fks) + "\n\n\n"

    save_path = "./sql_summary.sql"
    
    # save sql to file
    with open(save_path, "w", encoding="utf-8") as f:
        f.write(sql_summary)   
        f.write(fk_summary)
    
    
    print("******************************************************************")
    print("******************   sql generation completed   ******************")
    print("******************************************************************")



