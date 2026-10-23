# Student Care — gói ứng viên triển khai Vercel + Neon

**Không muốn cài phần mềm trên Mac?** Làm theo [Thiết lập hoàn toàn trong trình duyệt bằng Codespaces](SETUP-TREN-TRINH-DUYET.md).

**Bản chuyển đổi để kiểm thử triển khai, chưa được nghiệm thu trên hạ tầng thật.** Giữ giao diện, nhập Excel có bảng kiểm tra, lịch sử kỳ, hồ sơ và mẫu báo cáo đã làm. Thay API demo bằng API máy chủ. Không chứa dữ liệu thật, tài khoản mặc định hay khóa bí mật.

Bắt đầu với [Hướng dẫn từng màn hình cho người triển khai](BAT-DAU-TUNG-BUOC.md).

Đọc [Hướng dẫn triển khai](HUONG-DAN-TRIEN-KHAI.md), [Rà soát bảo mật](RA-SOAT-BAO-MAT.md) và [Vận hành/khôi phục](VAN-HANH.md) trước khi dùng dữ liệu thật.

## Đã thực hiện

- Mật khẩu 12–128 ký tự, có ký tự đặc biệt; cao hơn mức tối thiểu 8 được yêu cầu.
- Băm scrypt N=131072, r=8, p=1, salt ngẫu nhiên riêng; không lưu mật khẩu gốc.
- Xác thực TOTP bắt buộc, chống dùng lại cùng mã theo bước thời gian.
- Mật khẩu tạm bị chặn đọc/lưu dữ liệu cho đến khi đổi; phiên tạm 15 phút.
- Cookie Secure, HttpOnly, SameSite=Strict. Token ngẫu nhiên 256 bit; DB chỉ lưu hash token.
- Ô duy trì đăng nhập: chọn → tối đa 7 ngày; không chọn → cookie phiên trình duyệt, tối đa 8 giờ tại máy chủ. Phiên không duy trì hết hiệu lực sau 60 phút không gọi API; phiên duy trì sau 24 giờ không gọi API. Trình duyệt có thể khôi phục cookie phiên theo cài đặt riêng.
- Hỗ trợ trình quản lý mật khẩu bằng autocomplete; không tự lưu mật khẩu vào localStorage.
- Đổi/reset mật khẩu hoặc khóa user thu hồi phiên cũ. Origin, CSRF và giới hạn tốc độ ở máy chủ.
- Nghiệp vụ và bí mật TOTP mã hóa AES-256-GCM, IV ngẫu nhiên, AAD tách ngữ cảnh; khóa nằm ngoài DB/Git.
- SQL tham số hóa, kiểm tra bản lưu tại API, chặn xung đột ghi bằng revision, chống lặp lần lưu.
- CSP không CDN/unsafe-eval, no-store, chống iframe; không tự gửi dữ liệu tới AI.
- Sao lưu hàng ngày vào kho S3-compatible ngoài Neon, mã hóa bằng BACKUP_KEY riêng; tải lại/kiểm tra giải mã và giám sát thiếu backup.

## Phạm vi quyền và giới hạn

Admin đọc/ghi toàn workspace, cấp/khóa/reset user, sao lưu, xóa có xác nhận.
Staff **chỉ đọc toàn workspace và xuất dữ liệu**. Chưa phân quyền theo Mentor/cơ sở ở máy chủ. Không cấp staff cho người chỉ được xem một phần dữ liệu, không cấp cho SV.

Bản chuyển đổi còn lưu nghiệp vụ thành một tài liệu mã hóa: tối đa **3,5 MB/yêu cầu API**, nên giữ JSON khoảng ≤3 MB. Excel 5 MB/file, 10 file/lần, 50.000 dòng/sheet, 600 cột, tổng giải nén 30 MB. File gốc và bản xuất không lưu lại trên máy chủ; nghiệp vụ và nhật ký có lưu. Chặn ghi đè nhưng chưa tự hợp nhất thay đổi đồng thời.

Phù hợp chạy thử nhỏ. Trước quy mô lớn cần bảng riêng SV/kỳ/điểm danh, API phân trang/cập nhật từng bản ghi và hàng đợi nhập file. Không dùng gói này để tuyên bố đã tối ưu tải lớn.

Không thể bảo đảm “không AI nào đọc được”: người/tiện ích có quyền xem màn hình, tài khoản bị chiếm hoặc người tải file vẫn có thể sao chép. robots.txt không thay thế xác thực. Mã hóa bảo vệ DB/backup bị lấy cắp khi khóa còn riêng; không chống được việc chiếm máy chủ và khóa.

## Lệnh

~~~sh
npm ci --ignore-scripts
npm run build
npm test
node tests/client-smoke.cjs
npm run audit
npm run db:migrate
node scripts/init.mjs
npm run admin:create -- quantri.tenban
~~~

Node 24 LTS. Không đưa .env, Excel/CSV, backup hoặc ảnh dữ liệu SV vào GitHub. CI không dùng khóa thật.

## Tài liệu tham khảo

- https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
- https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
- https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html
- https://vercel.com/docs/cron-jobs/manage-cron-jobs
- https://vercel.com/docs/deployment-protection
- https://neon.com/docs/introduction/branch-restore
- https://docs.github.com/en/code-security/dependabot
