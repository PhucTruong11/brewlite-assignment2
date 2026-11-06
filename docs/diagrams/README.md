# Sơ đồ

Bản nháp Task 1.3 có sơ đồ use-case UC-01 tại [uc01-order-checkout.puml](uc01-order-checkout.puml), cùng bản xuất [PNG](uc01-order-checkout.png) và [SVG](uc01-order-checkout.svg). Sơ đồ này chưa được đưa vào báo cáo tổng hợp.

## Task 2

Đưa activity, sequence, class và deployment diagram vào đây. Mỗi sơ đồ cần **file nguồn** (`.puml` hoặc `.mmd`) và **file xuất** (`.svg` hoặc `.pdf`) cùng tên. Các SVG hiện có trong `../assets/` là tài liệu tham khảo; cần đối chiếu lại với code và yêu cầu Assignment 2 trước khi nộp.

Sequence cho luồng đặt và thanh toán phải có Customer, Next.js UI, NestJS API, PostgreSQL và Payment Service; thể hiện JWT, transaction giữ nguyên liệu, thanh toán thành công/thất bại và idempotency.
