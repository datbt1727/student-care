# Thiết lập Student Care chỉ bằng trình duyệt

Bạn không cần cài Node.js, không mở Terminal của macOS và không chạy mã trên máy Mac. Chúng ta dùng GitHub Codespaces: máy làm việc trực tuyến, mở ngay trong tab trình duyệt. Vẫn có nơi nhập lệnh, nhưng các lệnh chạy trên GitHub.

Bạn chỉ tải gói ZIP để upload bằng trình duyệt; không cần giải nén ZIP trên Mac.

Đây là thiết lập ban đầu. Sau khi hoàn thành, Vercel chạy website, Neon lưu dữ liệu, S3 giữ backup; Codespaces có thể dừng hoặc xóa sau khi đã lưu các khóa ở nơi riêng an toàn.

## 1. Bộ tên sử dụng

| Mục | Tên |
|---|---|
| GitHub repository | student-care, Private |
| Branch GitHub | main |
| Neon project thử | student-care-test |
| Database Neon | neondb |
| Role ứng dụng | studentcare_app, không đổi |
| Vercel project | student-care-tandat, thêm hậu tố nếu trùng |
| Admin ứng dụng | quantri.tandat |
| Bucket backup | student-care-backup-tandat-2026-abc123, thay hậu tố nếu trùng |

Tài khoản GitHub/Vercel/Neon là tài khoản quản lý nền tảng. Admin quantri.tandat là tài khoản riêng của website Student Care.

## 2. Tạo repo GitHub

Nếu đã có repo student-care chứa trực tiếp package.json ở gốc, bỏ qua tạo repo và upload ở bước 4; chỉ thêm file .devcontainer/devcontainer.json từ gói mới nếu repo chưa có.

Nếu chưa có:
1. Mở https://github.com/login và đăng nhập.
2. Mở https://github.com/new.
3. Repository name: student-care.
4. Chọn Private.
5. **Tích Add a README file** để repo có branch đầu tiên và mở được Codespaces.
6. Create repository.

README tạo sẵn chỉ là trang giữ chỗ, sau đó sẽ được thay bằng README của gói.

## 3. Mở máy làm việc trực tuyến

1. Trong repo student-care, bấm nút Code.
2. Chọn tab Codespaces.
3. Chọn Create codespace on main.
4. Nếu được hỏi nơi mở, chọn Open in browser, không chọn mở VS Code trên Mac.
5. Chờ xuất hiện giao diện soạn thảo với danh sách file bên trái.
6. Nếu chưa có khung dòng lệnh: menu trên cùng → Terminal → New Terminal.

**Đây là Terminal của máy GitHub, không phải Terminal của Mac.**

Nếu Codespaces không được bật hoặc báo hết hạn mức, kiểm tra https://github.com/settings/billing và chính sách tổ chức. Codespaces có hạn mức/chi phí tùy tài khoản; kiểm tra trước khi bật thanh toán. Không cần mua gói chỉ vì hướng dẫn này nếu tài khoản hiện tại đã có đủ hạn mức.

## 4. Đưa gói ZIP vào Codespaces

1. Tải Student-Care-Vercel-Neon-2026-10-23.zip đã được gửi kèm.
2. Trong Codespaces, vào Explorer bên trái.
3. Nhấp chuột phải vùng trống/dòng thư mục gốc → Upload; chọn file ZIP ở Downloads. Hoặc kéo file ZIP vào vùng Explorer.
4. Chờ tên file ZIP xuất hiện ở thư mục gốc, cùng tầng README.
5. Trong Terminal trực tuyến chạy từng dòng:

~~~sh
unzip -q Student-Care-Vercel-Neon-2026-10-23.zip -d /tmp/student-care-upload
cp -R /tmp/student-care-upload/Student-Care-Secure/. .
rm Student-Care-Vercel-Neon-2026-10-23.zip
~~~

Nếu máy GitHub báo không có lệnh unzip, dùng thay dòng đầu: python3 -m zipfile -e Student-Care-Vercel-Neon-2026-10-23.zip /tmp/student-care-upload; sau đó chạy hai dòng cp và rm như trên. Môi trường Codespaces mặc định thường có Python.

Nếu trình duyệt đổi tên ZIP thành có hậu tố (1), đổi tên file trong Explorer về đúng Student-Care-Vercel-Neon-2026-10-23.zip trước khi chạy.

Dòng cp chép nội dung gói vào repo mới, thay README giữ chỗ. Chỉ làm trên repo mới hoặc repo đang chờ khởi tạo; không chép đè tùy tiện project đã vận hành.

6. Kiểm tra Explorer có trực tiếp package.json, api, lib, scripts, web và .devcontainer. Không làm trong thư mục con api/web.
7. Nếu môi trường đầu tiên chưa dùng cấu hình Node 24: mở Command Palette qua menu View → Command Palette, tìm Codespaces: Rebuild Container và chọn. Chờ máy trực tuyến tạo lại. Dữ liệu trong thư mục workspace vẫn được giữ.
8. Mở Terminal trực tuyến, chạy:

~~~sh
node -v
npm -v
~~~

Node phải bắt đầu bằng v24. Cấu hình .devcontainer/devcontainer.json trong gói đã chọn sẵn Node 24, không phải cài lên Mac.

## 5. Cài và kiểm tra trên máy GitHub

Tại Terminal trực tuyến:

~~~sh
npm ci --ignore-scripts
npm run build
npm test
~~~

Không tạo port public, không cần chạy server thử trên Codespaces. Chúng ta dùng Codespaces để cấu hình và chạy công cụ; website sẽ chạy ở Vercel.

Sau khi kiểm tra đạt, lưu mã vào repo:

~~~sh
git status --short
git add .
git commit -m "Khoi tao Student Care"
git push
~~~

Lúc này chưa tạo .env. Nếu đã có .env từ trước, xác nhận không xuất hiện trong danh sách file chuẩn bị commit. Không dùng git add -f để ép thêm file bị bỏ qua.

Nếu repo đã có mã giống hệt và git báo nothing to commit, tiếp tục bước sau.

## 6. Tạo .env ngay trong Codespaces

1. Trong Terminal trực tuyến chạy:

~~~sh
node scripts/prepare-env.mjs
~~~

2. Trong Explorer mở file .env vừa được tạo. Nếu chưa hiện, bấm Refresh Explorer.
3. File đã có bốn khóa DATA_KEY, BACKUP_KEY, RATE_KEY, CRON_SECRET.
4. Các khóa này phải được giữ nguyên xuyên suốt init và deploy.
5. Từ đây, chỉnh .env trực tiếp trong tab soạn thảo Codespaces, dùng Command + S hoặc File → Save.
6. Không dùng lệnh open -a TextEdit, không cần TextEdit/macOS Terminal.

.env đang lưu trên máy làm việc GitHub và bị .gitignore loại khỏi commit; **không có nghĩa là được công khai an toàn**. Chỉ dùng repo và Codespace thuộc tài khoản được ủy quyền. Không chia sẻ quyền truy cập Codespace hay đưa nội dung khóa vào công cụ AI/chat.

Lưu các khóa vào trình quản lý bí mật riêng trước khi xóa Codespace. Không dựa vào Codespace làm bản giữ khóa duy nhất.

## 7. Tạo Neon và kết nối từ Codespaces

### D1. Đăng nhập và tạo project

1. Mở https://console.neon.tech.
2. Nếu chưa có tài khoản: chọn Sign up, có thể chọn Continue with GitHub.
3. Nếu đã có: Sign in bằng đúng tài khoản đã đăng ký.
4. Chọn New Project/Create project.
5. Điền Project name: student-care-test.
6. Chọn vùng gần nơi chạy ứng dụng; ưu tiên Singapore nếu tài khoản/vùng cung cấp, nếu không chọn vùng gần nhất phù hợp.
7. Giữ phiên bản PostgreSQL mặc định ổn định được Neon cung cấp.
8. Tạo project.
9. Vào project vừa tạo. Ghi nhớ branch đang chọn; dùng branch đó xuyên suốt.
10. Nếu database mặc định là neondb thì giữ nguyên. Không cần tạo thêm database tên student-care-test.

### D2. Lấy kết nối chủ sở hữu

1. Trong project chọn Connect.
2. Kiểm tra Branch là branch ở D1.
3. Database: neondb.
4. Role: role chủ sở hữu do Neon tạo, thường tên tương ứng database.
5. Tắt Connection pooling cho kết nối dùng migration này.
6. Sao chép Connection string bắt đầu bằng postgresql://.
7. Trong .env thay toàn bộ giá trị MIGRATION_DATABASE_URL bằng chuỗi vừa sao chép.
8. Đặt sslmode=verify-full. Nếu chuỗi đang có sslmode=require, thay đúng phần đó; giữ các tham số khác nếu có.
9. Lưu .env.

Không gửi chuỗi này qua chat hoặc chụp ảnh công khai: trong chuỗi có mật khẩu.

### D3. Tạo bảng và role ứng dụng

Quay lại Terminal trực tuyến của Codespaces, vẫn ở thư mục package.json, chạy lần lượt:

~~~sh
node --env-file=.env scripts/migrate.mjs
node --env-file=.env scripts/runtime-role.mjs
~~~

- Lệnh đầu phải báo đã tạo cấu trúc dữ liệu.
- Lệnh sau tạo studentcare_app và hiển thị mật khẩu một lần.
- Lưu mật khẩu vào trình quản lý mật khẩu.

**Không dùng nút Add role của Neon để tạo studentcare_app.** Role tạo theo Console/CLI/API có thể được cấp neon_superuser; script ở đây tạo bằng SQL và chỉ cấp quyền cần thiết. Nếu báo role đã tồn tại, dừng kiểm tra role cũ; không xóa hoặc đặt lại tùy tiện.

### D4. Lấy kết nối chạy ứng dụng

1. Quay lại Neon → project → Connect.
2. Chọn cùng Branch và Database.
3. Bật Connection pooling.
4. Nếu danh sách Role có studentcare_app, chọn role này; dùng mật khẩu ở D3 (mục 7) nếu được hỏi.
5. Nếu role tạo bằng SQL không hiện trong ô chọn, lấy host pooled từ Connect và ghép kết nối ở dạng:

~~~
postgresql://studentcare_app:MAT_KHAU_O_D3@HOST_POOLED_CUA_BAN/neondb?sslmode=verify-full
~~~

Thay đúng MAT_KHAU_O_D3 và HOST_POOLED_CUA_BAN. Host pooled thường có -pooler; dùng đúng host Neon đưa ra, không tự đoán.

Mật khẩu do script tạo chỉ dùng ký tự an toàn cho chuỗi kết nối. Nếu sau này tự đặt mật khẩu có @, :, /, # hoặc %, phải URL-encode phần mật khẩu.

6. Dán chuỗi vào DATABASE_URL trong .env.
7. Lưu, rồi chạy:

~~~sh
node --env-file=.env scripts/check-runtime.mjs
~~~

Phải thấy PASS. Nếu báo quyền thừa, chưa triển khai lên Vercel.

## 8. Tạo kho backup S3

Bạn có thể dùng S3-compatible khác, nhưng phần này chọn AWS S3 để có bộ tên và các bước cụ thể. AWS có thể yêu cầu thông tin thanh toán; kiểm tra giá và đặt cảnh báo chi phí.

### E1. Tạo bucket

1. Mở https://console.aws.amazon.com.
2. Đăng nhập tài khoản AWS của đơn vị; nếu chưa có, chọn Create a new AWS account và hoàn thành đăng ký.
3. Bật MFA cho tài khoản quản trị AWS, dùng danh tính quản trị được ủy quyền cho cấu hình.
4. Tại ô tìm kiếm dịch vụ gõ S3 → mở S3.
5. Chọn Create bucket.
6. Region: Asia Pacific (Singapore), mã ap-southeast-1.
7. Bucket name: student-care-backup-tandat-2026-abc123. Nếu trùng, thay abc123 bằng hậu tố khác.
8. Giữ Object Ownership: Bucket owner enforced/ACLs disabled.
9. Giữ toàn bộ Block Public Access được bật.
10. Bucket Versioning: Enable.
11. Giữ mã hóa phía S3 mặc định SSE-S3; ứng dụng còn mã hóa riêng bằng BACKUP_KEY trước khi tải lên.
12. Create bucket.
13. Không bật Static website hosting, không tạo public URL cho backup.

### E2. Tạo quyền chỉ đọc/ghi đối tượng backup

1. Trong AWS tìm dịch vụ IAM.
2. Vào Policies → Create policy → JSON.
3. Thay nội dung bằng mẫu sau, sửa tên bucket trong Resource thành tên thực tế ở E1:

~~~json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject"],
      "Resource": "arn:aws:s3:::student-care-backup-tandat-2026-abc123/daily/*"
    }
  ]
}
~~~

4. Next → Policy name: StudentCareBackupPutGet → Create policy.
5. IAM → Users → Create user.
6. User name: student-care-backup-writer.
7. Không cấp quyền đăng nhập AWS Management Console cho user kỹ thuật này.
8. Chọn Attach policies directly, tìm StudentCareBackupPutGet, tích chọn.
9. Tạo user. Không gắn thêm AdministratorAccess/AmazonS3FullAccess.
10. Mở user vừa tạo → Security credentials → Create access key.
11. Chọn mục đích Application running outside AWS nếu màn hình hỏi.
12. Tạo và lưu Access key ID cùng Secret access key vào trình quản lý bí mật. Secret thường chỉ hiện lúc tạo.

### E3. Điền .env

~~~
S3_ENDPOINT=https://s3.ap-southeast-1.amazonaws.com
S3_REGION=ap-southeast-1
S3_BUCKET=TEN_BUCKET_THUC_TE
S3_ACCESS_KEY_ID=ACCESS_KEY_ID_VUA_TAO
S3_SECRET_ACCESS_KEY=SECRET_ACCESS_KEY_VUA_TAO
~~~

Giữ BACKUP_KEY đã sinh ở bước 6. Không dùng khóa IAM của tài khoản root.

Theo chính sách đơn vị, cấu hình retention/Object Lock bằng tài khoản quản trị kho và xem thêm VAN-HANH.md. Policy trên không cho ứng dụng xóa backup hoặc thay chính sách bucket.

## 9. Tạo tài khoản Student Care

Trong Terminal trực tuyến của Codespaces:

~~~sh
node --env-file=.env scripts/init.mjs
node --env-file=.env scripts/admin.mjs quantri.tandat
~~~

1. Lệnh đầu tạo workspace trống, không chèn dữ liệu mẫu và không ghi đè workspace đã có.
2. Lệnh sau tạo tài khoản quantri.tandat, hiện mật khẩu tạm và khóa TOTP một lần.
3. Lưu riêng hai thông tin đó, không upload lên GitHub.
4. Trong ứng dụng xác thực TOTP bạn đang dùng, chọn thêm tài khoản bằng setup key/khóa thủ công.
5. Tên tài khoản trong ứng dụng xác thực: Student Care - quantri.tandat.
6. Secret/setup key: khóa TOTP vừa được in ra trong Terminal trực tuyến.
7. Loại: Time based. Ứng dụng sẽ hiện mã 6 chữ số đổi theo thời gian.

Tài khoản quantri.tandat chỉ đăng nhập vào website Student Care, không dùng để đăng nhập Vercel/Neon/GitHub.

## 10. Đưa website lên Vercel

### H1. Đăng nhập và import

1. Mở một tab trình duyệt mới đến https://vercel.com/login; giữ tab Codespaces để lấy giá trị .env.
2. Chọn Continue with GitHub, dùng tài khoản có repo student-care.
3. Vào https://vercel.com/new.
4. Tại Import Git Repository, tìm repo student-care.
5. Nếu không thấy, chọn cấu hình quyền GitHub App và cho Vercel truy cập riêng repo này.
6. Chọn Import.
7. Project Name: student-care-tandat; nếu tên không khả dụng, thêm tên đơn vị/hậu tố.
8. Framework Preset: Other.
9. Root Directory: để gốc repo, không chọn api, web hoặc dist.
10. Build Command: npm run build.
11. Output Directory: dist.
12. Install Command: npm ci --ignore-scripts.
13. Node.js Version: 24.x. Nếu chưa có ô này ở bước import, kiểm tra trong Project Settings sau khi tạo.

### H2. Điền Environment Variables

Trong phần Environment Variables của bước import, hoặc Project → Settings → Environment Variables, thêm từng dòng theo bảng. Tên biến phải giữ nguyên chữ hoa/dấu gạch dưới.

| Name | Value lấy ở đâu? |
|---|---|
| DATABASE_URL | Giá trị DATABASE_URL trong .env, dùng role studentcare_app |
| APP_ORIGIN | https://TEN_PROJECT_VERCEL_THUC_TE.vercel.app, không có / cuối |
| DATA_KEY | Giá trị DATA_KEY do bước 6 tạo, giữ nguyên |
| BACKUP_KEY | Giá trị BACKUP_KEY do bước 6 tạo |
| RATE_KEY | Giá trị RATE_KEY do bước 6 tạo |
| CRON_SECRET | Giá trị CRON_SECRET do bước 6 tạo |
| S3_ENDPOINT | https://s3.ap-southeast-1.amazonaws.com |
| S3_REGION | ap-southeast-1 |
| S3_BUCKET | Tên bucket thực tế ở E1 (mục 8) |
| S3_ACCESS_KEY_ID | Access key ID ở E2 (mục 8) |
| S3_SECRET_ACCESS_KEY | Secret access key ở E2 (mục 8) |
| MONITOR_PING_URL | Có khi cấu hình giám sát độc lập ở bước J; có thể bỏ trống lúc thử |

- Chỉ chọn Production cho bộ khóa/DB này.
- Không thêm MIGRATION_DATABASE_URL lên Vercel.
- Không thêm tiền tố NEXT_PUBLIC_ hoặc VITE_.
- Khi sao chép khóa, chỉ lấy phần sau dấu =, không lấy tên biến.
- Không dùng DATA_KEY khác với .env đã dùng để init ở mục 9.

### H3. Deploy và xác nhận địa chỉ

1. Chọn Deploy.
2. Chờ trạng thái Ready.
3. Mở Settings → Domains, lấy địa chỉ production được Vercel gán. Không dùng URL preview theo từng commit làm APP_ORIGIN.
4. Địa chỉ thực tế có thể khác tên bạn đoán nếu có trùng tên hoặc tên team.
5. Vào Settings → Environment Variables, sửa APP_ORIGIN đúng địa chỉ HTTPS thực tế.
6. Vào Deployments → bản mới nhất → menu dấu ba chấm → Redeploy.
7. Sau thay biến luôn redeploy; không chỉ bấm Save rồi dùng bản cũ.

Bảo vệ preview bằng Deployment Protection. Không dùng bộ khóa production cho nhánh preview. Xem HUONG-DAN-TRIEN-KHAI.md để cấu hình firewall và kiểm tra tải.

## 11. Đăng nhập lần đầu

1. Mở địa chỉ production ở H3.
2. Tên đăng nhập: quantri.tandat.
3. Mật khẩu: mật khẩu tạm ở mục 9.
4. Mã xác thực hai bước: mã 6 số hiện tại trong ứng dụng TOTP.
5. “Cho phép trình duyệt gợi ý lưu mật khẩu”: tùy bạn; trình duyệt quyết định có lưu hay không.
6. “Duy trì đăng nhập trên thiết bị này”: chỉ tích trên máy riêng, không dùng máy công cộng.
7. Chọn Đăng nhập.
8. Hệ thống yêu cầu đổi mật khẩu:
   - Mật khẩu hiện tại: mật khẩu tạm.
   - Mật khẩu mới: 12–128 ký tự, có ký tự đặc biệt và khác mật khẩu tạm.
   - Xác nhận: nhập lại mật khẩu mới.
9. Lưu, rồi đăng nhập lại bằng mật khẩu mới.
10. Nếu báo mã TOTP đã dùng, chờ mã 6 số tiếp theo.
11. Khi trình duyệt hỏi lưu mật khẩu, lưu mật khẩu mới, không lưu mật khẩu tạm.

Nếu đúng mật khẩu nhưng xác thực liên tục thất bại, kiểm tra thời gian tự động trên điện thoại/Mac.

## 12. Kiểm tra backup

1. Trong .env trong Codespaces, APP_ORIGIN có thể cập nhật cùng địa chỉ thật để ghi nhớ cấu hình; lệnh backup không dùng biến này.
2. Chạy:

~~~sh
node --env-file=.env scripts/backup.mjs
~~~

3. Phải có thông báo sao lưu và kiểm tra giải mã thành công.
4. Vào AWS → S3 → bucket đã tạo → Objects → daily/ → thư mục ngày → kiểm tra có file .json.enc.
5. Không đổi đuôi file này thành .json, không mở rồi lưu lại.
6. Vercel → project → Cron Jobs/Settings liên quan cron: kiểm tra tác vụ /api/backup. Lịch khoảng 00:15 giờ Việt Nam, phụ thuộc độ chính xác/gói dịch vụ.
7. Để có một cách thiết lập cụ thể, mở https://healthchecks.io → Sign Up/Log In bằng email quản trị được đơn vị cho phép.
8. Vào dashboard, chọn Add Check. Name: student-care-daily-backup.
9. Chọn lịch Simple, Period: 1 day/24 hours; Grace Time: 6 hours. Tổng chờ khoảng 30 giờ từ ping thành công gần nhất.
10. Vào Integrations/Notifications, thêm email quản trị nhận cảnh báo và xác nhận email nếu được yêu cầu; gắn kênh đó với check. Bạn tự quyết định người nhận.
11. Sao chép Ping URL của check, điền MONITOR_PING_URL vào Vercel Production rồi redeploy. Giữ Ping URL riêng tư để người ngoài không giả tín hiệu thành công.
12. Điền cùng URL vào .env trong Codespaces, chạy backup khi đã qua ngày mới hoặc theo lịch kế tiếp; kiểm tra trạng thái check. Backup đã thành công trong cùng ngày sẽ được bỏ qua để tránh chạy trùng.
13. Diễn tập khôi phục theo VAN-HANH.md vào Neon project riêng. Không thử restore lên database đang sử dụng.

Nguồn giám sát: https://healthchecks.io/docs/configuring_checks/ và https://healthchecks.io/docs/configuring_notifications/. Nếu đơn vị đã có hệ thống heartbeat tương đương, có thể dùng hệ thống đó thay vì tạo tài khoản mới.

Nếu chưa có heartbeat/backup thành công, chưa coi phần sao lưu vận hành là hoàn tất.

## 13. Lưu khóa và kết thúc phiên Codespaces

1. Xác nhận mã nguồn đã commit/push, CI đạt.
2. Xác nhận đã lưu riêng DATA_KEY, BACKUP_KEY, RATE_KEY, CRON_SECRET, mật khẩu DB, S3 credential và thông tin admin/TOTP trong nơi giữ bí mật được đơn vị chấp thuận.
3. Không commit .env. Không gửi khóa qua ảnh chụp/chia sẻ màn hình.
4. Mở https://github.com/codespaces.
5. Tại Codespace vừa sử dụng chọn menu dấu ba chấm → Stop codespace.
6. Đóng tab trình duyệt không nhất thiết dừng máy trực tuyến ngay. Stop dừng tính toán; dữ liệu lưu của Codespace vẫn có thể tính phí.
7. Sau khi xác nhận đã lưu đủ khóa và deploy/backup hoạt động, có thể chọn Delete để bỏ máy làm việc trực tuyến. Thao tác này xóa file riêng trong Codespace, bao gồm .env chưa commit; không xóa repo đã push, project Vercel hoặc DB Neon.
8. Khi bảo trì sau này, tạo/mở Codespace mới và khôi phục đúng khóa từ nơi giữ bí mật. **Không sinh DATA_KEY mới cho dữ liệu cũ.**

Người dùng Student Care hằng ngày chỉ mở website Vercel, không cần dùng Codespaces.

## 14. Tên file và thao tác cần tránh

- Giữ nguyên package.json, package-lock.json, vercel.json, schema.sql và thư mục api/lib/scripts/web.
- Giữ .devcontainer/devcontainer.json để Codespaces chọn Node 24.
- Chỉ .env.example được commit; .env luôn riêng tư.
- Không bật public cho port Codespaces.
- Không đưa Excel sinh viên thật vào repo/Codespaces. Nhập qua giao diện ứng dụng sau khi nghiệm thu.
- Chưa mở quyền nhập dữ liệu cho staff: bản này staff chỉ đọc toàn workspace.
- Không xem hệ thống là production đã nghiệm thu chỉ vì deployment báo Ready; vẫn cần kiểm tra Neon/S3 thật, backup/restore và quy mô dữ liệu.

## Nguồn chính thức

- Tạo Codespace: https://docs.github.com/en/codespaces/developing-in-a-codespace/creating-a-codespace-for-a-repository
- Node trong Codespaces: https://docs.github.com/en/codespaces/setting-up-your-project-for-codespaces/adding-a-dev-container-configuration/setting-up-your-nodejs-project-for-codespaces
- Vòng đời máy trực tuyến: https://docs.github.com/en/codespaces/about-codespaces/understanding-the-codespace-lifecycle
- Chi phí: https://docs.github.com/en/billing/concepts/product-billing/github-codespaces
