# Bản ứng viên triển khai Business RC1 — 20/11/2026

## Kết luận và phạm vi
Đã tự động hóa các tình huống học lại cùng mã/cùng nhóm/cùng Part, chuyển lớp lũy kế, sửa ngày nguồn, nhập trùng, trộn MSSV không hợp lệ, Follow/QA độc lập; API quyền/CSRF/CAS/retry/checkpoint.
Người dùng đã xác nhận AEG tách hai lượt 13/40 và 8/40, nhập lại/note/QA đạt trên staging; đối chiếu chi tiết báo chỉ thay Part AEG đã phê duyệt, giữ nguyên dữ liệu gốc được kiểm tra.
Không yêu cầu lặp lại các bước này. Đây là ứng viên triển khai mã, chưa có thao tác Production.

## Thay đổi cho môi trường thật
- Mặc định tắt API xác nhận lượt học nếu chưa cấu hình SC_STUDY_DECISIONS.
- Staging giữ giá trị staging và runner Codespaces riêng.
- Chỉ bật trên Vercel Production với SC_STUDY_DECISIONS=production, APP_ORIGIN đúng địa chỉ HTTPS và VERCEL_ENV=production do Vercel cung cấp.
- Dùng S3_ENDPOINT, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_BUCKET, BACKUP_KEY đang có cho sao lưu. Không đổi DATA_KEY/BACKUP_KEY hiện có.
- Điểm khôi phục trước thay đổi nằm dưới study-checkpoints/ trong bucket riêng. Nội dung mã hóa bằng BACKUP_KEY; tải lại, kiểm tra hash và giải mã trước commit. Không dùng ổ đĩa tạm Vercel.
- Thiếu cấu hình hoặc xác minh thất bại: dừng trước ghi dữ liệu, không báo đã lưu.
- Không thêm SQL schema, không migration tự động và không tự gửi email.

## Chuẩn bị triển khai an toàn
1. Giữ nguyên website Production đang hoạt động. Không sao chép .env.staging hoặc archive staging sang Production.
2. Tạo nhánh mã riêng từ phiên bản hiện hành; giải nén gói vào bản sao mã của nhánh đó. Giữ riêng .env và checkpoint; không commit chúng.
3. Chạy npm ci, npm run build, npm test, npm run security:check tại Codespaces. Dependency audit mới phải đạt trước phát hành; không chỉ dựa vào quét tĩnh.
4. Kiểm tra danh sách file thay đổi; không đưa ZIP, file sinh viên, baseline, checkpoint, .env lên GitHub.
5. Trước thao tác dữ liệu Production phải có sao lưu mã hóa được xác minh và phương án quay lại mã đang chạy.
6. Chỉ khi được phê duyệt mới push/triển khai Production. Gói này không tự thực hiện bước đó.
7. Kiểm tra đăng nhập, quyền, đọc dữ liệu và cấu hình kho sao lưu thật; sau đó mới bật SC_STUDY_DECISIONS=production.

## Dữ liệu Production và staging độc lập
42 chỉnh sửa Part AEG và các lựa chọn thử trên staging KHÔNG được tự coi là đã áp dụng ở Production. Không chạy apply 88 hoặc chép archive staging vào dữ liệu thật.
Nếu Production vẫn phân GAE2442 vào Part 1, cần kế hoạch metadata riêng dựa trên revision Production hiện tại, xem trước/sao lưu/phê duyệt trước áp dụng. Không suy ra revision thật từ staging.
Bản này không tự sửa năm học, không gộp lịch sử không rõ lượt, không tự xác định học lại bằng tên nhóm/ngày lớp.

## Rollback
- Khi chưa có thao tác mới: quay lại deployment mã trước, giữ database và khóa hiện có.
- Khi đã có metadata/lượt mới: tắt tính năng ghi trước, giữ dữ liệu, đối chiếu revision và checkpoint. Không khôi phục toàn archive cũ nếu đã phát sinh nhập/note mới.
- API hoàn tác chỉ cho quyết định chưa có dữ liệu/quyết định khác tham chiếu; trường hợp còn lại cần kế hoạch phục hồi riêng.

## Giới hạn kiểm chứng
Kết quả tự động không phải thử tải Production hoặc pentest. Kết nối/quyền kho S3/B2 Production và audit dependency mới chưa được chạy từ môi trường cục bộ này. Không cam kết an toàn tuyệt đối hoặc không bao giờ gián đoạn.
