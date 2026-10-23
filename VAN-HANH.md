# Vận hành, sự cố và khôi phục

## Mỗi ngày

- Xem thời điểm backup thành công. Quá 30 giờ phải cảnh báo.
- Giám sát ngoài hệ thống phải báo khi không có ping; nếu cả Vercel/DB sập, ứng dụng không thể tự gửi cảnh báo đáng tin cậy.
- Kiểm tra lỗi API, giới hạn tài nguyên/quota, các lần đăng nhập thất bại tăng bất thường.
- Kiểm tra không có dữ liệu SV/mật khẩu trong logs, GitHub hoặc công cụ analytics. Không bật session replay/AI telemetry chứa dữ liệu.
- Có người chịu trách nhiệm xử lý cảnh báo, tránh cảnh báo không ai đọc.

Cron chạy một lần/ngày. Mất dữ liệu tối đa mục tiêu khoảng 24 giờ kể từ bản độc lập gần nhất, có thể dài hơn nếu backup lỗi. Không cam kết RPO/RTO khi chưa diễn tập và có SLA tương ứng. Neon PITR có thể giảm mất dữ liệu trong cửa sổ lịch sử của gói; không thay bản độc lập.

## Hằng tuần/tháng

- Theo dõi Dependabot/npm audit; chạy CI và thử staging trước khi nâng thư viện.
- Kiểm tra tài khoản, thu hồi người nghỉ việc/quyền thừa.
- Tải backup bằng tài khoản quản trị kho, chạy kiểm tra:

~~~sh
node --env-file=.env scripts/verify-backup.mjs duong-dan-file.json.enc
~~~

Lệnh giải mã vào bộ nhớ, kiểm tra cấu trúc và đọc ciphertext nghiệp vụ; không tạo file plaintext.
- Mỗi tháng hoặc khi đổi schema/khóa: phục hồi vào Neon project/DB **riêng**, dùng thông tin xác thực thử, kiểm tra số SV/kỳ, lịch sử, báo cáo và đăng nhập.
- Giữ versioning/retention đủ dài. Khóa ứng dụng không được xóa backup.

## Diễn tập khôi phục

1. Tạo DB tách biệt, không trỏ tới production.
2. Thiết lập MIGRATION_DATABASE_URL đến DB thử; DATA_KEY và BACKUP_KEY đúng với thời điểm backup.
3. Chạy migration.
4. Không chạy init/admin:create trước restore; target không được có tài khoản.
5. Chạy:

~~~sh
node --env-file=.env scripts/migrate.mjs
node --env-file=.env scripts/restore.mjs backup.json.enc RESTORE-INTO-ISOLATED-DATABASE
~~~

6. Script từ chối target đã có tài khoản, kiểm tra giải mã, phục hồi users/archive/audit trong transaction. Không phục hồi sessions; tất cả tài khoản bắt buộc đổi mật khẩu.
7. Chạy grants cho runtime, dùng deployment staging riêng để thử. Không gửi email/thông báo tự động.
8. So sánh số hồ sơ, kỳ, điểm danh, lịch sử, mẫu QA với số kiểm soát đã ghi riêng.
9. Đo thời gian phục hồi, ghi kết quả, xóa môi trường thử theo chính sách.

Nếu phục hồi để thay production thật: đóng quyền ghi hệ thống cũ, tạo backup hiện trạng, xác minh bản cần khôi phục, phê duyệt chuyển DATABASE_URL/deploy, kiểm tra lại và chỉ mở ghi sau nghiệm thu. Không hướng dẫn ghi đè dữ liệu production tùy tiện.

## Khi không lưu được/xung đột

- Thông báo thành công chỉ có sau phản hồi server. Bản còn trên màn hình chưa chắc đã được lưu.
- Xung đột 409: không cố gửi lại JSON cũ để ghi đè; tải bản mới và nhập lại thay đổi có kiểm tra.
- Giữ file nguồn ban đầu ở nơi nội bộ kiểm soát để nhập lại khi cần. Hệ thống không lưu file gốc.
- API body quá lớn: chia nhỏ lịch sử hoặc chuyển kiến trúc bản ghi trước mở rộng. Không loại bỏ giới hạn an toàn.

## Nghi bị lộ tài khoản

- Khóa user từ admin khác, thu hồi phiên. Đổi/reset mật khẩu và xác minh TOTP còn an toàn.
- Nếu mất thiết bị TOTP: quản trị kỹ thuật xác minh danh tính qua quy trình riêng rồi cấp lại secret bằng công cụ quản trị kiểm soát, không tự gửi secret cũ qua email.
- Chưa có tự khôi phục MFA qua web/email. Không mở endpoint bypass.
- Quản trị được ủy quyền có thể chạy lệnh offline sau xác minh danh tính:

~~~sh
node --env-file=.env scripts/recover-account.mjs ten.taikhoan IDENTITY-VERIFIED
~~~

Lệnh cấp lại mật khẩu tạm + TOTP, bắt đổi mật khẩu, thu hồi mọi phiên và ghi audit. Không tự mở khóa tài khoản đang bị khóa. Không chạy trong CI, không dùng nếu chưa xác minh danh tính.
- Nếu lộ khóa DB/Vercel/S3: thu hồi credential, chặn truy cập, bảo toàn audit, điều tra phạm vi trước mở lại. Nhận tư vấn chuyên trách khi ảnh hưởng dữ liệu cá nhân.

## Rotation khóa dữ liệu

Gói này chưa có tự động rotation nhiều phiên bản khóa. Không thay biến DATA_KEY trực tiếp khi còn ciphertext cũ.

Quy trình do quản trị kỹ thuật thực hiện: đóng ghi → backup đã xác minh → chạy công cụ migration đọc bằng khóa cũ và mã hóa lại archive cùng toàn bộ totp_cipher bằng khóa mới trong transaction → thử trên clone → triển khai khóa mới → kiểm tra đăng nhập/dữ liệu → lưu khóa cũ riêng để đọc backup cũ theo chính sách. Không xóa khóa cũ trước hết thời gian lưu backup.

BACKUP_KEY có thể thay cho các bản backup mới; phải giữ khóa cũ và nhãn phiên bản khóa trong sổ bí mật để đọc file cũ. Không lưu khóa cạnh backup.
