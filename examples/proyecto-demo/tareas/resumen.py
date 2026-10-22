"""Tarea de ejemplo en Python: lee un CSV y escribe un resumen en Excel (usa openpyxl)."""
import sys

from openpyxl import Workbook


def main() -> int:
    if "--check" in sys.argv:
        Workbook()
        print("python ok")
        return 0
    libro = Workbook()
    libro.active.append(["producto", "ventas"])
    libro.active.append(["demo", 1])
    libro.save("resumen.xlsx")
    print("resumen.xlsx escrito")
    return 0


if __name__ == "__main__":
    sys.exit(main())
