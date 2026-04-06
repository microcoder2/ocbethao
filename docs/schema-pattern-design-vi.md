# Pattern Design Schema Mới

Tài liệu này mô tả pattern schema mới cho `ocbethao`, theo hướng:

- không clone menu ngày một cách vô lý
- truy được nguồn tăng giảm tồn kho
- giữ được lịch sử giá bán đúng theo từng đơn
- vẫn phù hợp với UI vận hành quán hiện tại

Phạm vi của tài liệu này là `single restaurant first`.
Chưa bàn tới multi-tenant, billing, plans, hay white-label.

## 1. Mục tiêu

Pattern mới phải giải được 4 vấn đề:

1. `DailyMenu` không còn là nơi clone toàn bộ ngân hàng món mỗi ngày.
2. Tồn kho phải truy được: giảm vì đơn nào, trả lại vì hủy nào, tăng vì chỉnh tay nào.
3. Báo cáo doanh thu và món bán chạy phải đúng dù cùng một món có nhiều mức giá theo thời gian.
4. Frontend admin/customer không bị ép viết lại toàn bộ chỉ vì đổi schema.

## 2. Nguyên tắc cốt lõi

### 2.1 Danh tính món phải ổn định

Danh tính thật của món là:

- `menuItemId`
- hoặc `menu_item.slug`

Không dùng `dailyMenuItemId` làm identity dài hạn của món.

Lý do:

- `dailyMenuItemId` chỉ là row override của một ngày cụ thể
- có ngày món vẫn bán bình thường nhưng không hề có row `daily_menu_item`
- nếu group báo cáo theo `dailyMenuItemId` thì cùng một món sẽ bị tách nhỏ vô nghĩa

Kết luận:

- identity nghiệp vụ của món: `menuItemId`
- identity của override trong ngày: `dailyMenuItemId`
- identity của giao dịch bán: `orderItem.id`

### 2.2 Giá cấu hình và giá đã bán là hai loại dữ liệu khác nhau

Phải tách rõ:

- giá cấu hình hiện tại
- giá override của ngày
- giá đã chốt trong đơn

Trong pattern mới:

- `MenuItem.currentPrice`: giá mặc định hiện hành của món
- `MenuItemPrice`: lịch sử thay đổi giá cấu hình
- `DailyMenuItem.overridePrice`: giá đặc biệt của riêng ngày đó, nếu có
- `OrderItem.unitPrice`: giá fact lúc bán, không được suy luận ngược từ bảng khác

Kết luận:

- báo cáo doanh thu luôn lấy từ `OrderItem.unitPrice` và `OrderItem.lineTotal`
- không lấy `MenuItemPrice` để tính doanh thu quá khứ

### 2.3 Menu ngày là lớp publish/override, không phải bản sao toàn bộ catalog

`DailyMenu` chỉ đại diện cho:

- ngày phục vụ
- banner/note/trạng thái publish
- pool nguyên liệu của ngày
- override thật sự khác mặc định

Nó không nên là nơi chứa full snapshot tất cả món của catalog mỗi ngày.

### 2.4 Tồn kho phải đi qua event log

Không đủ nếu chỉ có:

- `quantity`
- `soldQuantity`

Vì hai số đó không trả lời được:

- đơn nào đã trừ kho
- món nào bị hủy đã hoàn kho chưa
- staff đã chỉnh tay lúc nào

Pattern mới dùng:

- `InventoryMovement` làm event log
- `OrderItemConsumption` làm snapshot tiêu hao theo từng dòng món

## 3. Nhóm bảng theo trách nhiệm

## 3.1 Catalog gốc

Đây là dữ liệu nền tương đối ổn định.

### `Category`

Mục đích:

- phân nhóm hiển thị món

### `Ingredient`

Mục đích:

- định danh nguyên liệu gốc
- làm gốc để map sang pool nguyên liệu của ngày

### `MenuItem`

Mục đích:

- ngân hàng món
- identity ổn định của món

Cột quan trọng:

- `id`
- `slug`
- `name`
- `currentPrice`
- `status`
- `isAvailable`
- `categoryId`

Khuyến nghị:

- dùng trực tiếp tên `currentPrice`
- không giữ thêm một field `basePrice` khác nghĩa để tránh nhập nhằng

### `MenuItemPrice`

Mục đích:

- lưu lịch sử giá cấu hình của món

Pattern:

- mỗi lần đổi giá chuẩn, append một row mới
- không dùng bảng này làm giá doanh thu quá khứ

### `MenuItemIngredientPreset`

Mục đích:

- recipe/preset mặc định của món
- cho biết một món mặc định tiêu hao nguyên liệu nào, bao nhiêu

Vai trò trong pattern mới:

- làm cầu nối mặc định giữa `MenuItem` và `DailyStockPool`
- giúp tính được món còn bán được bao nhiêu mà không cần clone `DailyMenuItemStock` mỗi ngày

Ví dụ:

- `hao-nuong-mo-hanh` mặc định dùng nguyên liệu `hao`
- `consumeQuantity = 1`

Nếu ngày hôm nay có pool `hao`, hệ thống tự hiểu món đó có thể bán từ pool đó mà không cần tạo override row riêng.

## 3.2 Service day

Đây là lớp dữ liệu vận hành theo ngày.

### `DailyMenu`

Mục đích:

- đại diện cho một ngày phục vụ
- status của ngày đó: draft/published/archived
- banner, note, metadata

Không dùng để:

- clone toàn bộ catalog theo ngày

### `DailyStockPool`

Mục đích:

- pool nguyên liệu của ngày
- số lượng được allocate cho ngày đó

Ý nghĩa:

- `quantity`: lượng được allocate cho ngày
- `soldQuantity`: cache đọc nhanh trong giai đoạn chuyển tiếp
- nguồn sự thật truy vết vẫn là `InventoryMovement`

Rule:

- đây là bảng hợp lý để tồn tại theo ngày
- vì quán thực sự vận hành theo “kho hôm nay”

### `DailyMenuItem`

Pattern mới:

- đây là bảng `override only`
- chỉ lưu row khi ngày đó khác mặc định

Lưu row khi có ít nhất một điều kiện:

- đổi giá so với giá chuẩn hiện hành
- đổi highlight
- explicit enable một món vốn mặc định không bật
- explicit disable một món vốn mặc định đang bật
- đổi mapping pool/định mức tiêu hao so với preset mặc định

Không lưu row khi:

- món đang đúng mặc định từ catalog + preset + pool ngày

### `DailyMenuItemStock`

Pattern mới:

- chỉ lưu khi có custom mapping thật
- không clone mapping mặc định của tất cả món mỗi ngày

Ví dụ:

- mặc định `Hào nướng mỡ hành` dùng pool `hào`, `consumeQuantity = 1`
- ngày hôm nay không có thay đổi gì đặc biệt
- vậy không cần tạo `daily_menu_item_stock`

Chỉ tạo khi:

- món đó hôm nay dùng pool khác mặc định
- hoặc `consumeQuantity` khác preset

## 3.3 Transaction fact

Đây là dữ liệu giao dịch thật, không được suy diễn lại từ config.

### `Order`

Mục đích:

- snapshot trạng thái đơn
- khách, bàn, tiền, nguồn tạo đơn, trạng thái thanh toán

### `OrderItem`

Đây là bảng fact cực kỳ quan trọng.

Cột cần giữ:

- `menuItemId`
- `dailyMenuItemId` nullable
- `itemNameSnapshot`
- `unitPrice`
- `quantity`
- `lineTotal`
- `note`
- stage quantities

Ý nghĩa:

- `menuItemId`: identity thật của món
- `dailyMenuItemId`: override row của ngày nếu lúc đó có
- `itemNameSnapshot`: tên món lúc bán
- `unitPrice`: giá đúng lúc chốt dòng món
- `lineTotal`: doanh thu fact của dòng đó

Rule:

- mọi báo cáo bán hàng phải bám vào `OrderItem`

## 3.4 Inventory trace

### `InventoryMovement`

Mục đích:

- event log cho kho

Mỗi movement cần trả lời được:

- nguyên liệu nào
- pool nào của ngày nào
- tăng hay giảm
- liên quan đơn nào / order item nào
- ai tạo
- lúc nào
- lý do gì

Ví dụ movement type:

- `MENU_POOL_INCREASE`
- `MENU_POOL_DECREASE`
- `ORDER_RESERVE`
- `ORDER_RELEASE`
- `ORDER_RESTORE`
- `MANUAL_ADJUST`
- `CORRECTION`

### `OrderItemConsumption`

Mục đích:

- snapshot chính xác một dòng món đã tiêu hao pool nào, bao nhiêu

Tại sao cần:

- sau này mapping pool có thể đổi
- nhưng order cũ vẫn phải truy lại được nó đã ăn vào pool nào lúc đó

## 4. Rule đọc dữ liệu

## 4.1 Khi đọc menu ngày cho admin/customer

Không đọc theo kiểu:

- lấy trực tiếp `DailyMenu.items` rồi coi đó là toàn bộ menu bán trong ngày

Phải đọc theo kiểu merge:

1. lấy `MenuItem` từ catalog
2. lấy `MenuItemIngredientPreset`
3. lấy `DailyStockPool` của ngày
4. lấy `DailyMenuItem` override của ngày
5. lấy `DailyMenuItemStock` custom link nếu có
6. merge thành `effective offer`

Kết quả trả ra cho frontend nên có:

- `menuItemId`
- `dailyMenuItemId` nullable
- `key`
- `sellingPrice`
- `availableQuantity`
- `isAvailable`
- `highlightLabel`
- `stockLinks`

Khuyến nghị:

- không expose `id âm` ra public API
- dùng `key` dạng:
  - `offer:<dailyMenuItemId>`
  - `menu:<menuItemId>`

## 4.2 Khi tạo đơn

Client nên gửi:

```json
{
  "dailyMenuItemId": 123,
  "menuItemId": 45,
  "quantity": 2,
  "note": "không hành"
}
```

Rule:

- nếu có `dailyMenuItemId` thật thì dùng override đó
- nếu không có `dailyMenuItemId` thì resolve theo `menuItemId` + effective offer của ngày
- không bắt buộc món phải có row `daily_menu_item` thì mới order được

## 4.3 Khi lưu order item

Backend phải snapshot vào `OrderItem`:

- `menuItemId`
- `dailyMenuItemId`
- `itemNameSnapshot`
- `unitPrice`
- `lineTotal`

Đồng thời ghi:

- `InventoryMovement`
- `OrderItemConsumption`

## 5. Rule ghi dữ liệu

## 5.1 Lưu menu ngày

Admin chỉnh menu ngày theo UI cũ:

- kho hôm nay
- bật/tắt món
- đổi giá nếu cần
- đổi pool nếu cần

Backend save theo rule:

- `DailyStockPool`: chỉ lưu pool có ý nghĩa
- `DailyMenuItem`: chỉ lưu row diff
- `DailyMenuItemStock`: chỉ lưu row custom mapping

Nói ngắn:

- save theo `diff-only`
- không save full snapshot

## 5.2 Chỉnh tồn kho

Khi tăng/giảm pool nguyên liệu:

- cập nhật số đọc nhanh trên pool
- đồng thời append `InventoryMovement`

Không được chỉ update số tổng mà không có log.

## 5.3 Hủy món / phục hồi món

Phải luôn có 2 tác động:

1. cập nhật stage/status/order item
2. ghi movement kho tương ứng

Nếu không, số tồn sẽ lệch nhưng không biết lệch từ đâu.

## 6. Quy tắc thống kê

## 6.1 Thống kê món bán chạy

Group theo:

- `OrderItem.menuItemId`

Không group theo:

- `DailyMenuItemId`

Chỉ số:

- `SUM(quantity)` để tính số phần đã bán
- có thể group thêm theo ngày, tháng, category

## 6.2 Thống kê doanh thu

Lấy từ:

- `OrderItem.lineTotal`
- hoặc `Order.totalAmount` tùy cấp báo cáo

Không tính doanh thu bằng:

- `MenuItemPrice`
- `DailyMenuItem.overridePrice`

vì đó là bảng config, không phải fact giao dịch.

## 6.3 Thống kê cùng một món có nhiều lịch sử giá

Pattern mới support đúng case này.

Ví dụ:

- Tháng 3: `Hào nướng mỡ hành` bán `99.000`
- Tháng 4: cùng món đó bán `109.000`

Muốn thống kê:

- số lượng bán của món:
  - group theo `menuItemId`
  - `SUM(quantity)`
- doanh thu của món:
  - group theo `menuItemId`
  - `SUM(lineTotal)`
- phân tích lịch sử giá của món:
  - group theo `menuItemId + unitPrice`

Như vậy:

- cùng một món vẫn thống kê gộp được
- vẫn nhìn ra từng giai đoạn giá khác nhau

## 7. Những thứ không nên làm

1. Không dùng `dailyMenuItemId` làm identity dài hạn của món.
2. Không dùng `MenuItemPrice` để tính doanh thu quá khứ.
3. Không clone full `daily_menu_item` cho mọi món mỗi ngày.
4. Không clone full `daily_menu_item_stock` cho mọi mapping mặc định mỗi ngày.
5. Không chỉ update `soldQuantity` mà không có `InventoryMovement`.
6. Không để public API trả synthetic numeric id kiểu âm.

## 8. Khuyến nghị API contract

Cho item trong daily menu response:

```json
{
  "key": "menu:45",
  "dailyMenuItemId": null,
  "menuItemId": 45,
  "sellingPrice": 99000,
  "availableQuantity": 8,
  "isAvailable": true,
  "highlightLabel": "Mỡ hành"
}
```

Hoặc khi có override thật:

```json
{
  "key": "offer:123",
  "dailyMenuItemId": 123,
  "menuItemId": 45,
  "sellingPrice": 109000,
  "availableQuantity": 6,
  "isAvailable": true,
  "highlightLabel": "Giá cuối tuần"
}
```

Ý nghĩa:

- `key`: dành cho FE render/select
- `dailyMenuItemId`: id thật của override row nếu có
- `menuItemId`: identity thật của món

## 9. Migration thực dụng cho ocbethao

Thứ tự hợp lý:

### Phase 1

- thêm `InventoryMovement`
- thêm `OrderItemConsumption`
- dual-write ở flow create/update/cancel/restore order

### Phase 2

- chuyển `DailyMenuItem` sang `diff-only`
- chuyển `DailyMenuItemStock` sang `custom-link only`
- giữ shape response gần cũ cho FE

### Phase 3

- bỏ dần reliance vào `id giả`
- public API dùng `key + menuItemId + dailyMenuItemId`
- dọn logic thống kê theo `OrderItem`

## 10. Kết luận

Pattern schema mới nên hiểu đơn giản là:

- `Catalog` là gốc của món và recipe mặc định
- `DailyMenu` là lớp publish/override theo ngày
- `DailyStockPool` là allocation kho của ngày
- `OrderItem` là fact bán hàng bất biến
- `InventoryMovement` và `OrderItemConsumption` là nguồn truy vết kho

Nếu giữ đúng pattern này thì hệ thống sẽ có 3 lợi ích lớn:

1. Dữ liệu menu ngày không phình vô lý.
2. Kho truy được nguyên nhân tăng giảm.
3. Thống kê cùng một món qua nhiều lịch sử giá vẫn đúng.
