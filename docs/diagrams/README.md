# Sơ đồ Task 1 và 2

Sơ đồ Task 1.3 và Task 2 được lưu dưới dạng nguồn PlantUML (`.puml`) và bản xuất (`.svg`, `.png`). LaTeX dùng bản PNG cùng tên.

| Mục | Sơ đồ tổng quan | Sơ đồ chi tiết |
| --- | --- | --- |
| Task 1.3 | [Use-case UC-01](uc01-order-checkout.puml) | |
| Task 2.1 | [Activity](activity-checkout-overview.puml) | [Giữ kho](activity-order-reservation.puml), [thẻ mô phỏng](activity-idempotency.puml), [PayOS](activity-payos-webhook.puml) |
| Task 2.2 | [Sequence](sequence-checkout-overview.puml) | [Tạo đơn](sequence-order-reservation.puml), [idempotency](sequence-idempotency.puml), [PayOS](sequence-payos-webhook.puml) |
| Task 2.3 | [Class domain](class-domain.puml) | |

Xuất lại ảnh khi sửa file nguồn. Chạy từ thư mục gốc, dùng JAR PlantUML trên máy:

```powershell
$plantumlJar = 'C:/tools/plantuml.jar'
$diagrams = Get-ChildItem docs/diagrams -Filter *.puml | Select-Object -ExpandProperty FullName
java -jar $plantumlJar -charset UTF-8 -tpng @diagrams
java -jar $plantumlJar -charset UTF-8 -tsvg @diagrams
```
