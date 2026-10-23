# Kết quả rà soát — 23/10/2026

## Kết luận

Bản HTML cũ là demo lưu trên thiết bị, không phải ranh giới bảo mật. Gói mới có backend và lớp bảo vệ thực thi trên máy chủ. **Chưa thể xác nhận an toàn production** vì chưa có Vercel/Neon/S3 thật, kiểm thử xâm nhập độc lập, kiểm thử tải hoặc diễn tập khôi phục thực tế.

Không cam kết chống mọi cuộc tấn công, mọi AI, không sập hoặc không mất dữ liệu. Chưa có tài khoản nền tảng nào được kết nối/triển khai trong phiên làm việc này.

## Các phát hiện và xử lý

| Phát hiện ở bản demo | Hướng xử lý trong gói mới | Phần còn cần xác minh |
|---|---|---|
| API mô phỏng, đường vào demo | Loại toàn bộ module dịch vụ demo khỏi bản triển khai; không có user/mật khẩu mặc định | Thử API trên URL thật |
| Dữ liệu/session có thể lưu cục bộ | Dữ liệu phiên chỉ ở bộ nhớ; cookie HttpOnly cho phiên | Kiểm tra storage/BFCache trên trình duyệt mục tiêu |
| Kiểm tra mật khẩu ở client không đủ | Chính sách + băm scrypt tại server | Kiểm tra giới hạn CPU/RAM Vercel |
| Mật khẩu tạm có thể chỉ chặn bằng giao diện | Server chặn mọi đọc/ghi nghiệp vụ khi must_change/pending | Kiểm thử gọi thẳng API |
| Chiếm mật khẩu có thể đăng nhập | TOTP bắt buộc, chống replay, rate limit dùng DB | Quy trình bàn giao/khôi phục MFA của đơn vị |
| Dữ liệu JSON/DB lộ khi bị sao chép | AES-256-GCM cho nghiệp vụ/TOTP, khóa ngoài DB | Phân quyền khóa và rotation |
| Ghi đè giữa hai người dùng | Transaction, khóa hàng, revision và request ID | Tải đồng thời thực tế; chưa tự merge |
| File lớn/ZIP quá nén gây treo | Giới hạn file, dòng/cột, kích thước khai báo giải nén | Trình phân tích Excel chạy main thread; cần worker cho file lớn |
| XSS trong dữ liệu nhập | Escape sẵn có + CSP JS cùng nguồn + chặn markup trong JSON ở server | Chưa có rà soát từng luồng DOM bởi bên thứ ba; không coi đây là chứng minh hết XSS |
| Quét dữ liệu ẩn danh | Tất cả API nghiệp vụ cần phiên, quyền, CSRF; noindex | DDoS ở biên và chống tài khoản được phép sao chép |
| Sao lưu chỉ mô phỏng hoặc cùng nơi | Backup mã hóa ngoài Neon + tải lại kiểm tra giải mã + ping giám sát | Cấu hình bucket/cron, restore thật |
| Thư viện có thể lỗi thời | Dependency khóa phiên bản, npm audit, CI và Dependabot | Theo dõi cảnh báo liên tục, audit không phát hiện mọi mã độc |
| Quyền staff có thể vượt phạm vi | Staff chỉ đọc; mọi ghi tài liệu phải admin tại API | Chưa có phân quyền từng Mentor/cơ sở |

## Kiểm thử đã chạy

- 17 kiểm thử tự động (gồm một kịch bản tích hợp nhiều bước): mật khẩu/scrypt, mã hóa và chống sửa ciphertext, TOTP theo vector chuẩn và chống replay, kiểm tra JSON/markup/prototype, Origin/CSRF, chưa đăng nhập, bắt buộc đổi lần đầu, staff không ghi, thu hồi phiên, cookie duy trì.
- Smoke test tương tác bằng DOM fixture: khởi tạo giao diện, login/TOTP/remember, preview nhập, xác nhận lưu qua API, không ghi storage thật.
- Phân tích cú pháp các script đóng gói.
- npm audit cho dependency production: không phát hiện lỗ hổng đã biết tại thời điểm chạy.
- Các ca quyền API dùng giả lập truy vấn; đã bổ sung kịch bản dùng bộ máy PostgreSQL nhúng PGlite, chạy schema và truy vấn thực: xác thực, transaction, chống trùng/xung đột, backup/restore vào DB trống, quyền runtime không được tạo bảng/xóa audit. S3 giả lập transport. **Chưa kiểm thử kết nối Neon và S3 thật**.
- Không chạy browser visual QA/kiểm thử trên Vercel thật trong gói này.

## Hiệu năng và tính sẵn sàng

Đã có pool kết nối nhỏ, timeout, rate limit chung ở DB, giới hạn kích thước, lưu chống trùng/xung đột và backup độc lập.

Chưa có phân trang server, cập nhật theo hàng, hàng đợi xử lý/worker, cụm đa vùng, failover tự động hoặc benchmark tải. JSON nguyên khối là hạn chế kiến trúc cần giải quyết trước mở rộng. Không nên tăng trần body chỉ để vượt giới hạn.

## Các điều kiện không được bỏ qua trước production

1. Hoàn tất các ca nghiệm thu trong hướng dẫn trên môi trường thử thật.
2. Quyền DB tối thiểu; khóa ngoài Git/DB và có kế hoạch phục hồi.
3. Backup ngoài Neon, cảnh báo độc lập, diễn tập restore.
4. Vercel firewall, bảo vệ preview; MFA/passkey cho tài khoản nền tảng.
5. Chốt phạm vi truy cập nhân viên. Staff hiện đọc toàn bộ; không giả vờ giới hạn theo Mentor bằng bộ lọc UI.
6. Đánh giá dữ liệu cá nhân, thời gian giữ/xóa, quyền xuất file, thiết bị nhân viên và trách nhiệm vận hành.
7. Rà soát độc lập trước khi chứa dữ liệu nhạy cảm thực tế.

## Nguồn đối chiếu

OWASP Password Storage, Authentication, Cryptographic Storage; Vercel Cron Jobs/Deployment Protection; Neon Instant Restore/History Window; GitHub Dependabot/Advisory Database. Liên kết trong README. Đây là rà soát mã nguồn ứng dụng, không phải chứng nhận hoặc bảo đảm của các nhà cung cấp.
