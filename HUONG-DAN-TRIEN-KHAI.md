# Triển khai từng bước

Nếu cần địa chỉ đăng nhập, tên project và thao tác từng màn hình, đọc [BẮT ĐẦU TỪNG BƯỚC](BAT-DAU-TUNG-BUOC.md) trước.

## 1. Chuẩn bị

Cần GitHub, Vercel, Neon và kho S3-compatible riêng để sao lưu ngoài Neon. Ba nền tảng đầu không tự tạo bản dự phòng độc lập nếu mất cả tài khoản Neon.

Bật 2FA/passkey cho tài khoản chủ các nền tảng. Chọn gói có thời gian thực thi, vùng lưu trữ và lịch sử khôi phục đáp ứng yêu cầu. Không giả định gói miễn phí có SLA hay lưu backup dài hạn.

Không đưa dữ liệu SV thật vào preview. Các HTML demo cũ không được dùng làm hệ thống dữ liệu thật công khai.

## 2. Neon thử nghiệm

1. Tạo project/database riêng, chọn vùng gần Vercel Functions.
2. Lấy kết nối chủ sở hữu direct cho migration; kết nối pooled cho ứng dụng.
3. Bắt buộc TLS xác minh chứng chỉ, dùng sslmode=verify-full; không tắt xác minh.
4. Lưu MIGRATION_DATABASE_URL ở máy quản trị. Không đưa biến này lên Vercel.
5. Tạo cấu trúc:

~~~sh
npm ci --ignore-scripts
node --env-file=.env scripts/migrate.mjs
~~~

6. Tạo runtime role bằng SQL qua lệnh dưới, **không dùng nút Add role/CLI/API tạo role của Neon**, vì những cách đó có thể tự cấp neon_superuser:

~~~sh
node --env-file=.env scripts/runtime-role.mjs
~~~

Lệnh chạy bằng MIGRATION_DATABASE_URL, tạo role hạn chế, cấp grants cần thiết và hiện mật khẩu một lần. Không chạy trong CI. Nếu role đã tồn tại, lệnh từ chối; kiểm tra role cũ thay vì tự ghi đè.

7. DATABASE_URL dùng studentcare_app và mật khẩu vừa cấp qua pooled connection. Chạy kiểm tra:

~~~sh
node --env-file=.env scripts/check-runtime.mjs
~~~

Nguồn: https://neon.com/docs/manage/roles và https://neon.com/docs/manage/database-access.
8. Kiểm tra runtime không tạo bảng, không xóa/sửa audit. Xác minh quyền bằng kết nối thật; không bỏ qua nếu giao diện quản lý role khác theo gói.

Migration tạo bảng nếu chưa tồn tại, không xóa dữ liệu cũ.

## 3. Khóa và biến môi trường

Chạy riêng cho DATA_KEY, BACKUP_KEY, RATE_KEY và CRON_SECRET:

~~~sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
~~~

Mỗi biến một giá trị khác. Lưu trong trình quản lý bí mật. Giữ bản phục hồi khóa tách khỏi Neon/S3/GitHub; hai quản trị viên được ủy quyền cần biết quy trình.

Không đặt khóa trong HTML, biến public, ảnh chụp, chat hoặc Git. Không đổi DATA_KEY tùy tiện: mất khóa thì không thể giải mã dữ liệu cũ.

Tạo .env từ .env.example ở máy tin cậy, giới hạn quyền đọc. .env đã bị loại khỏi Git.

## 4. Kho backup độc lập

1. Bucket private riêng, chặn public access và anonymous listing.
2. Bật versioning/retention/Object Lock nếu nhà cung cấp hỗ trợ.
3. Khóa chạy ứng dụng chỉ được PutObject/GetObject ở prefix daily/, không DeleteObject hoặc đổi policy.
4. Đặt lifecycle qua tài khoản quản trị, giữ hằng ngày ít nhất 30 ngày hoặc lâu hơn theo quy định đơn vị.
5. Điền các biến S3_* trong .env/Vercel.
6. Tạo dịch vụ giám sát độc lập kiểu dead man's switch: quá 30 giờ không nhận ping thành công thì cảnh báo quản trị. MONITOR_PING_URL là URL riêng. Không đưa dữ liệu cá nhân vào ping.

Bạn tự chọn nơi nhận cảnh báo. Gói chuẩn bị chưa gửi thông báo cho ai.

## 5. Khởi tạo và admin đầu tiên

~~~sh
node --env-file=.env scripts/init.mjs
node --env-file=.env scripts/admin.mjs quantri.tenban
~~~

Lệnh cấp tài khoản hiển thị mật khẩu tạm và khóa TOTP một lần. Đăng ký khóa với ứng dụng xác thực. Không chạy lệnh này trong GitHub Actions vì log có bí mật.

Đăng nhập bằng mật khẩu tạm + TOTP, đổi mật khẩu mới trước khi vào dữ liệu, rồi đăng nhập lại. Nếu cùng mã TOTP cũ, chờ mã tiếp theo. Mật khẩu 12–128 ký tự, có ký tự đặc biệt, khác mật khẩu cũ.

## 6. GitHub

1. Tạo repository Private.
2. Chỉ đưa nội dung thư mục gói này lên repo, không đưa cả outputs/work cũ.
3. Kiểm tra không có .env, Excel thật, backup hoặc khóa.
4. Commit package-lock.json, dùng npm ci.
5. Bật branch protection, yêu cầu CI và phê duyệt thay đổi.
6. Bật Dependabot alerts và secret scanning/push protection nếu gói hỗ trợ.
7. Workflow build/test/audit không nhận secrets dữ liệu thật từ PR.

## 7. Vercel

1. Import repo private, Framework Preset Other, Node 24.
2. Build npm run build; Output Directory dist.
3. Thêm biến theo .env.example, trừ MIGRATION_DATABASE_URL.
4. APP_ORIGIN là origin HTTPS production chính xác, không có dấu / cuối, ví dụ https://student-care-donvi.vercel.app.
5. Preview dùng DB/khóa riêng hoặc không có khóa, không kết nối dữ liệu production.
6. Deploy. Khi biết domain lần đầu, sửa APP_ORIGIN đúng và redeploy.
7. Bật Deployment Protection cho preview; cân nhắc production/cổng truy cập doanh nghiệp và allowlist IP.
8. Bật firewall/rate limiting tại biên cho /api/rpc, đặc biệt thử đăng nhập. Giới hạn DB không thay thế chống DDoS.
9. Không tắt CSP để chữa giao diện. JS đã đóng gói cùng nguồn.
10. Cron khai báo 15 17 * * * = 17:15 UTC ≈ 00:15 hôm sau ở Việt Nam. Vercel gửi Bearer CRON_SECRET. Kiểm tra khả năng/độ lệch lịch theo gói dịch vụ.
11. Chạy thử cron trong dashboard và kiểm tra logs/bucket. Backup lỗi phải trả lỗi, không báo thành công giả.

## 8. Nghiệm thu trước dữ liệu thật

Dùng dữ liệu giả trên URL đã triển khai:
- User mới chưa đổi mật khẩu: API load/save bị chặn.
- Sai password/TOTP bị từ chối; một mã không dùng lại.
- Tick duy trì tạo cookie tối đa 7 ngày (hết hạn khi không hoạt động 24 giờ); không tick tạo cookie phiên (không hoạt động 60 phút). Kiểm tra Secure/HttpOnly/SameSite trong DevTools.
- Khóa/reset/đổi mật khẩu làm phiên cũ hết quyền.
- API trực tiếp không có phiên/CSRF hoặc khác origin bị chặn.
- Staff chỉ đọc toàn workspace, không lưu/xóa/cấp user.
- Kiểm tra bảng preview cả SV và môn trước nhập; trạng thái/Level âm, lịch sử và QA đúng.
- Hai trình duyệt sửa cùng revision: bên sau nhận 409, không ghi đè.
- Ngắt mạng lúc lưu: không báo thành công; tải lại kiểm tra.
- Thử dữ liệu XSS, file hỏng/quá lớn/ZIP quá nén trong môi trường thử.
- Chạy backup, tải bản mã hóa, khôi phục thử vào DB tách biệt.
- Kiểm tra cảnh báo khi backup lỗi và cron không chạy.
- Đo tải theo số SV/dòng/nhân viên thực tế, thời gian nhập và quota. Gói chưa có kết quả tải trên dịch vụ thật.

Chỉ dùng thật khi người phụ trách xác nhận đạt. Rà soát cơ sở xử lý dữ liệu, phạm vi nhân viên, thời hạn giữ/xóa và vùng lưu trữ theo yêu cầu đơn vị; đây không phải chứng nhận tuân thủ pháp luật.

## 9. Bàn giao

Cấp user tại Quản trị; mật khẩu tạm và khóa TOTP bàn giao riêng, không gửi chung kênh công khai. Staff là đọc toàn workspace, chưa là quyền nhập theo Mentor.

Có ô cho phép trình duyệt gợi ý lưu mật khẩu; đây là gợi ý autocomplete, trình duyệt/người dùng quyết định lưu, ứng dụng không lưu mật khẩu. Chỉ tick duy trì trên máy riêng có khóa màn hình. Khóa tài khoản khi nghỉ việc.

Excel/PDF tải về không còn được bảo vệ bởi phiên web hoặc mã hóa Neon; bảo quản trong thư mục được kiểm soát và không chia sẻ công khai.
