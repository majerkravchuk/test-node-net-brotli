using System.Buffers.Binary;
using System.IO.Compression;
using System.Net.Sockets;
using System.Text;

internal class Program
{
    private const int NEGOTIATION_HEADER   = 0x2A;
    private const int USE_COMPRESSION_FLAG = 0x01;
    // private const int USE_NO_COMPRESSION_FLAG = 0x00;

    private static async Task Main(string[] args)
    {
        using TcpClient client = new("localhost", 4000);
        Stream inputStream = client.GetStream();
        Stream outputStream = inputStream;

        WriteInt32BigEndian(outputStream, NEGOTIATION_HEADER);
        WriteInt32BigEndian(outputStream, USE_COMPRESSION_FLAG);
        // WriteInt32BigEndian(outputStream, USE_NO_COMPRESSION_FLAG);

        if (ReadInt32BigEndian(inputStream) == NEGOTIATION_HEADER)
        {
            Console.WriteLine("successful negotiation");
        }
        else
        {
            Console.WriteLine("negotiation failed");
            return;
        }

        if (ReadInt32BigEndian(inputStream) == USE_COMPRESSION_FLAG)
        {
            Console.WriteLine("switch to compression mode");
            inputStream = new BrotliStream(inputStream, CompressionMode.Decompress);
        }
        else
        {
            Console.WriteLine("switch to compression mode failed, continue without compression");
        }

        while (true)
        {
            // Пинок сервера, "запрос"
            WriteInt32BigEndian(outputStream, 0xF);

            var length = ReadInt32BigEndian(inputStream);
            var buffer = new byte[length];
            inputStream.ReadExactly(buffer);

            string response = Encoding.UTF8.GetString(buffer, 0, length);
            Console.WriteLine($"Received: {response}");
            await Task.Delay(1000);
        }
    }

    private static void WriteInt32BigEndian(Stream stream, int value)
    {
        Span<byte> buffer = stackalloc byte[sizeof(int)];
        BinaryPrimitives.WriteInt32BigEndian(buffer, value);
        stream.Write(buffer);
    }

    private static int ReadInt32BigEndian(Stream stream)
    {
        Span<byte> buffer = new byte[sizeof(int)];
        stream.ReadExactly(buffer);
        return BinaryPrimitives.ReadInt32BigEndian(buffer);
    }
}
